import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { createRedisConnection } from "@betng/service-kit";
import type { RedisConnection } from "@betng/service-kit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { actorCacheKey } from "../src/clients/index.js";
import { loadGatewayConfig, loadGatewaySettings } from "../src/configs/index.js";
import type { GatewayApp } from "../src/app.js";

interface Seen {
  readonly method: string;
  readonly url: string;
  readonly headers: IncomingMessage["headers"];
  readonly body: Buffer;
}

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:56379";
const PREFIX = `gwtest-${crypto.randomUUID().slice(0, 8)}`;
const INTERNAL = `test-internal-${crypto.randomUUID()}`;
const previousInternal = process.env["INTERNAL_SERVICE_TOKEN"];

const customer = (id: string) => ({ kind: "CUSTOMER", id, role: "CUSTOMER", name: "Ada", permissions: [] });

const SESSIONS = new Map<string, unknown>([
  ["cust-limit-token-0000000", customer("11111111-1111-4111-8111-111111111111")],
  ["cust-body-token-00000000", customer("11111111-1111-4111-8111-111111111112")],
  ["cust-cache-token-0000000", customer("11111111-1111-4111-8111-111111111113")],
  ["cust-plain-token-0000000", customer("11111111-1111-4111-8111-111111111114")],
  ["cust-down-token-00000000", customer("11111111-1111-4111-8111-111111111115")],
  ["cashier-token-0000000000", { kind: "CASHIER", id: "22222222-2222-4222-8222-222222222222", role: "CASHIER", name: "Tobi", shopId: "33333333-3333-4333-8333-333333333333", permissions: ["shifts:operate"] }],
  ["support-token-0000000000", { kind: "ADMIN", id: "44444444-4444-4444-8444-444444444444", role: "SUPPORT", name: "Sam", permissions: ["users:read", "health:read"] }],
]);

const seen: Seen[] = [];
let identityCalls = 0;
let upstream: Server;
let gateway: GatewayApp;
let degraded: GatewayApp;
let redis: RedisConnection;
let base: string;
let degradedBase: string;

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await readBody(request);
  const url = request.url ?? "";

  response.setHeader("content-type", "application/json");

  if (url === "/rpc") {
    identityCalls += 1;
    const frame = JSON.parse(body.toString()) as { id: string; payload: { token: string } };
    const session = SESSIONS.get(frame.payload.token);

    response.end(
      JSON.stringify(
        session === undefined
          ? { id: frame.id, success: false, error: { code: "UNAUTHENTICATED", message: "no" } }
          : { id: frame.id, success: true, result: { ...(session as object), expiresAt: new Date(Date.now() + 60_000).toISOString() } },
      ),
    );
    return;
  }

  seen.push({ method: request.method ?? "", url, headers: request.headers, body });

  if (url === "/ready" || url === "/health") {
    response.end(JSON.stringify({ status: "ok", version: "1.0.0" }));
    return;
  }

  response.end(JSON.stringify({ ok: true }));
}

function upstreamEnv(url: string, redisUrl: string, port: number): Record<string, string> {
  const env: Record<string, string> = { GATEWAY_PORT: String(port), HOST: "127.0.0.1", LOG_LEVEL: "fatal", NODE_ENV: "test", REDIS_URL: redisUrl };

  for (const name of ["MATCH", "BETTING", "WALLET", "SETTLEMENT", "SIMULATION", "ODDS", "RISK", "ANALYTICS", "IDENTITY", "EVENT"]) {
    env[`${name}_SERVICE_URL`] = url;
  }

  return env;
}

const SETTINGS = {
  CORS_ORIGINS: "http://localhost:4200",
  GATEWAY_TRUST_PROXY: "127.0.0.1",
  GATEWAY_REDIS_PREFIX: PREFIX,
  GATEWAY_ACTOR_CACHE_SECONDS: "5",
  GATEWAY_RATE_GLOBAL: "8/60",
  GATEWAY_RATE_CREDENTIAL: "2/60",
  GATEWAY_RATE_BETS: "2/60",
  GATEWAY_RATE_HEALTH: "2/60",
  GATEWAY_MAX_BODY_BYTES: "2048",
  GATEWAY_WEBHOOK_MAX_BODY_BYTES: "1024",
  GATEWAY_HSTS: "on",
  GATEWAY_IP_BLOCKLIST: "203.0.113.0/24, 2001:db8::/32",
};

beforeAll(async () => {
  process.env["INTERNAL_SERVICE_TOKEN"] = INTERNAL;

  redis = createRedisConnection(REDIS_URL);
  await redis.connect();

  upstream = createServer((request, response) => void handle(request, response));
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${String((upstream.address() as AddressInfo).port)}`;

  gateway = createApp(await loadGatewayConfig(upstreamEnv(url, REDIS_URL, 4191)), loadGatewaySettings(SETTINGS));
  degraded = createApp(await loadGatewayConfig(upstreamEnv(url, "redis://127.0.0.1:1", 4192)), loadGatewaySettings(SETTINGS));

  await gateway.server.start();
  await degraded.server.start();
  base = `http://127.0.0.1:${String(gateway.server.port)}`;
  degradedBase = `http://127.0.0.1:${String(degraded.server.port)}`;
});

afterAll(async () => {
  for (const app of [gateway, degraded].filter((entry): entry is GatewayApp => entry !== undefined)) {
    await app.server.stop();
    for (const close of app.onShutdown) await close();
  }

  for (const key of await redis.client.keys(`${PREFIX}:*`)) await redis.client.del(key);
  await redis.close();
  await new Promise((resolve) => upstream.close(resolve));

  if (previousInternal === undefined) delete process.env["INTERNAL_SERVICE_TOKEN"];
  else process.env["INTERNAL_SERVICE_TOKEN"] = previousInternal;
});

let nextIp = 10;

function freshIp(): string {
  nextIp += 1;

  return `192.0.2.${String(nextIp)}`;
}

function call(path: string, init: RequestInit & { ip?: string; token?: string } = {}, root = base): Promise<Response> {
  const { ip, token, headers, ...rest } = init;

  return fetch(`${root}${path}`, {
    ...rest,
    headers: {
      "x-forwarded-for": ip ?? freshIp(),
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      ...(rest.body === undefined ? {} : { "content-type": "application/json" }),
      ...(headers as Record<string, string> | undefined),
    },
  });
}

async function errorCode(response: Response): Promise<string> {
  return ((await response.json()) as { error: { code: string } }).error.code;
}

describe("gateway rate limits", () => {
  it("answers 429 with Retry-After once one address passes the global limit", async () => {
    const ip = freshIp();
    const statuses: number[] = [];

    for (let index = 0; index < 8; index += 1) {
      statuses.push((await call("/api/v1/matches", { ip })).status);
    }

    const limited = await call("/api/v1/matches", { ip });

    expect(statuses.every((status) => status === 200)).toBe(true);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(limited.headers.get("x-request-id")).toMatch(/.{8,}/);
    expect(await errorCode(limited)).toBe("RATE_LIMITED");

    expect((await call("/api/v1/matches", { ip: freshIp() })).status).toBe(200);
  });

  it("limits credential routes per address, 2FA and password reset included", async () => {
    const ip = freshIp();
    const first = await call("/api/v1/auth/login/2fa", { method: "POST", body: "{}", ip });
    const second = await call("/api/v1/auth/password/reset", { method: "POST", body: "{}", ip });
    const third = await call("/api/v1/auth/login/2fa", { method: "POST", body: "{}", ip });

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(third.status).toBe(429);
  });

  it("limits bet placement per customer, whatever address it comes from", async () => {
    const token = "cust-limit-token-0000000";
    const place = () => call("/api/v1/bets", { method: "POST", body: "{}", token });

    expect((await place()).status).toBe(200);
    expect((await place()).status).toBe(200);

    const limited = await place();

    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).not.toBeNull();
  });

  it("fails closed on money routes and open on reads when Redis is unreachable", async () => {
    const token = "cust-down-token-00000000";
    const bet = await call("/api/v1/bets", { method: "POST", body: "{}", token }, degradedBase);
    const deposit = await call("/api/v1/payments/deposit/initiate", { method: "POST", body: "{}", token }, degradedBase);
    const read = await call("/api/v1/bets", { token }, degradedBase);

    expect(bet.status).toBe(503);
    expect(await errorCode(bet)).toBe("SERVICE_UNAVAILABLE");
    expect(deposit.status).toBe(503);
    expect(read.status).toBe(200);
  });

  it("rate limits the admin health view and keeps it to health:read", async () => {
    const denied = await call("/api/v1/admin/health/services", { token: "cashier-token-0000000000" });
    const statuses: number[] = [];

    for (let index = 0; index < 3; index += 1) {
      statuses.push((await call("/api/v1/admin/health/services", { token: "support-token-0000000000" })).status);
    }

    expect(denied.status).toBe(403);
    expect(statuses).toEqual([200, 200, 429]);
  });
});

describe("gateway body limits and webhooks", () => {
  it("refuses an oversized body before it reaches a service", async () => {
    const before = seen.length;
    const response = await call("/api/v1/bets", { method: "POST", body: JSON.stringify({ pad: "x".repeat(3000) }), token: "cust-body-token-00000000" });

    expect(response.status).toBe(413);
    expect(await errorCode(response)).toBe("PAYLOAD_TOO_LARGE");
    expect(response.headers.get("x-request-id")).not.toBeNull();
    expect(seen.length).toBe(before);
  });

  it("applies the smaller webhook limit", async () => {
    const response = await call("/api/v1/payments/webhook/paystack", { method: "POST", body: JSON.stringify({ pad: "x".repeat(1500) }) });

    expect(response.status).toBe(413);
  });

  it("forwards a webhook byte for byte with its signature header and nothing else from the caller", async () => {
    const raw = '{ "event":"charge.success",  "data":{"amount":50000,"reference":"R-1"} ,"z":1.50 }';
    const response = await call("/api/v1/payments/webhook/paystack", {
      method: "POST",
      body: raw,
      ip: "198.51.100.20",
      headers: { "x-paystack-signature": "abc123def", authorization: "Bearer forged-token-000000000", "x-betng-actor-kind": "ADMIN", "verif-hash": "not-for-paystack" },
    });
    const forwarded = seen.at(-1);

    expect(response.status).toBe(200);
    expect(forwarded?.url).toBe("/api/v1/payments/webhook/paystack");
    expect(forwarded?.body.toString()).toBe(raw);
    expect(forwarded?.headers["x-paystack-signature"]).toBe("abc123def");
    expect(forwarded?.headers["content-type"]).toBe("application/json");
    expect(forwarded?.headers["x-betng-client-ip"]).toBe("198.51.100.20");
    expect(forwarded?.headers["verif-hash"]).toBeUndefined();
    expect(forwarded?.headers.authorization).toBeUndefined();
    expect(forwarded?.headers["x-betng-actor-kind"]).toBeUndefined();
  });
});

describe("gateway response headers", () => {
  it("sets the API security headers on success and on errors", async () => {
    for (const response of [await call("/api/v1/bets", { token: "cust-plain-token-0000000" }), await call("/api/v1/bets")]) {
      expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000; includeSubDomains");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("permissions-policy")).toContain("camera=()");
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("echoes and forwards a caller's request id, and mints one otherwise", async () => {
    const supplied = await call("/api/v1/matches", { headers: { "x-request-id": "support-ref-12345" } });
    const forwardedId = seen.at(-1)?.headers["x-request-id"];
    const minted = await call("/api/v1/nothing-here");
    const forged = await call("/api/v1/matches", { headers: { "x-request-id": "short" } });

    expect(supplied.headers.get("x-request-id")).toBe("support-ref-12345");
    expect(forwardedId).toBe("support-ref-12345");
    expect(seen.at(-1)?.headers["x-request-id"]).toBe(forged.headers.get("x-request-id"));
    expect(minted.status).toBe(404);
    expect(minted.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(forged.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("gateway IP blocklist", () => {
  it("refuses statically listed ranges before routing", async () => {
    const before = seen.length;
    const v4 = await call("/api/v1/matches", { ip: "203.0.113.77" });
    const v6 = await call("/api/v1/matches", { ip: "2001:db8::1" });

    expect(v4.status).toBe(403);
    expect(v6.status).toBe(403);
    expect(v4.headers.get("x-request-id")).not.toBeNull();
    expect(seen.length).toBe(before);
  });

  it("refuses addresses added to the Redis set at runtime", async () => {
    const ip = "198.51.100.66";

    expect((await call("/api/v1/matches", { ip })).status).toBe(200);

    await redis.client.sAdd(`${PREFIX}:blocked-ips`, ip);

    expect((await call("/api/v1/matches", { ip })).status).toBe(403);
    expect((await call("/api/v1/matches", { ip: "198.51.100.67" })).status).toBe(200);
  });
});

describe("gateway session cache", () => {
  it("serves from the cache until identity evicts the key, then resolves afresh", async () => {
    const token = "cust-cache-token-0000000";
    const key = actorCacheKey(token);

    expect(key).toBe(`gateway:actor:${createHash("sha256").update(token).digest("hex")}`);

    expect((await call("/api/v1/bets", { token })).status).toBe(200);
    const callsAfterFirst = identityCalls;
    const ttl = await redis.client.ttl(key);

    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(5);

    SESSIONS.delete(token);

    expect((await call("/api/v1/bets", { token })).status).toBe(200);
    expect(identityCalls).toBe(callsAfterFirst);

    await redis.client.del(key);

    const revoked = await call("/api/v1/bets", { token });

    expect(revoked.status).toBe(401);
    expect(identityCalls).toBe(callsAfterFirst + 1);
  });

  it("sends identity a hash of the session on account routes, never the token", async () => {
    const token = "cust-plain-token-0000000";

    await call("/api/v1/account/sessions", { token });

    const forwarded = seen.at(-1)?.headers ?? {};

    expect(forwarded["x-betng-session-hash"]).toBe(createHash("sha256").update(token).digest("hex"));
    expect(forwarded.authorization).toBeUndefined();
    expect(forwarded["x-betng-actor-kind"]).toBe("CUSTOMER");
  });
});

describe("gateway route table", () => {
  it("serves the new routes with their access rules", async () => {
    const kycAsSupport = await call("/api/v1/admin/kyc/pending", { token: "support-token-0000000000" });
    const rgAsSupport = await call("/api/v1/admin/responsible-gaming", { token: "support-token-0000000000" });
    const shift = await call("/api/v1/shop/shifts/current", { token: "cashier-token-0000000000" });
    const cash = await call("/api/v1/shop/shifts/current/cash", { method: "POST", body: "{}", token: "cashier-token-0000000000" });
    const limits = await call("/api/v1/limits/summary", { token: "cust-plain-token-0000000" });
    const limitsAsCashier = await call("/api/v1/limits/summary", { token: "cashier-token-0000000000" });

    expect(kycAsSupport.status).toBe(403);
    expect(rgAsSupport.status).toBe(200);
    expect(shift.status).toBe(200);
    expect(cash.status).toBe(403);
    expect(limits.status).toBe(200);
    expect(limitsAsCashier.status).toBe(403);
  });

  it("keeps /metrics internal", async () => {
    const outside = await call("/metrics");
    const inside = await call("/metrics", { headers: { "x-betng-internal-token": INTERNAL } });
    const text = await inside.text();

    expect(outside.status).toBe(404);
    expect(inside.status).toBe(200);
    expect(inside.headers.get("content-type")).toContain("text/plain");
    expect(text).toContain('route="/api/v1/matches"');
    expect(text).toContain("http_request_duration_seconds_bucket");
    expect(text).toContain("process_resident_memory_bytes");
    expect(text).not.toContain("cust-");
  });
});
