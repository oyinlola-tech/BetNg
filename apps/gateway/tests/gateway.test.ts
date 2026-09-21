import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadGatewayConfig } from "../src/configs/index.js";
import type { GatewayApp } from "../src/app.js";

interface Seen {
  readonly method: string;
  readonly url: string;
  readonly headers: IncomingMessage["headers"];
  readonly body: string;
}

const SESSIONS: Record<string, unknown> = {
  "customer-token-0000000000": { kind: "CUSTOMER", id: "11111111-1111-4111-8111-111111111111", role: "CUSTOMER", name: "Ada", permissions: [] },
  "cashier-token-00000000000": { kind: "CASHIER", id: "22222222-2222-4222-8222-222222222222", role: "CASHIER", name: "Tobi Ọ", shopId: "33333333-3333-4333-8333-333333333333", permissions: ["tickets:sell", "tickets:check"] },
  "support-token-00000000000": { kind: "ADMIN", id: "44444444-4444-4444-8444-444444444444", role: "SUPPORT", name: "Sam", permissions: ["users:read"] },
  "super-token-0000000000000": { kind: "ADMIN", id: "55555555-5555-4555-8555-555555555555", role: "SUPER_ADMIN", name: "Root", permissions: ["users:read", "risk:read", "risk:write", "health:read"] },
};

const seen: Seen[] = [];
let upstream: Server;
let gateway: GatewayApp;
let base: string;

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString()));
    request.on("end", () => resolve(body));
  });
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await readBody(request);
  const url = request.url ?? "";

  response.setHeader("content-type", "application/json");

  if (url === "/rpc") {
    const frame = JSON.parse(body) as { id: string; payload: { token: string } };
    const session = SESSIONS[frame.payload.token];

    response.end(
      JSON.stringify(
        session === undefined
          ? { id: frame.id, success: false, error: { code: frame.payload.token.startsWith("expired") ? "SESSION_EXPIRED" : "UNAUTHENTICATED", message: "no" } }
          : { id: frame.id, success: true, result: { ...session, expiresAt: new Date(Date.now() + 60_000).toISOString() } },
      ),
    );
    return;
  }

  seen.push({ method: request.method ?? "", url, headers: request.headers, body });

  if (url === "/health" || url === "/ready") {
    response.end(JSON.stringify({ status: "ok", version: "9.9.9" }));
    return;
  }

  if (url.endsWith("/auth/logout")) {
    response.statusCode = 204;
    response.end();
    return;
  }

  response.end(JSON.stringify({ items: [], echoed: url }));
}

beforeAll(async () => {
  upstream = createServer((request, response) => void handle(request, response));
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));

  const url = `http://127.0.0.1:${String((upstream.address() as AddressInfo).port)}`;
  const env: Record<string, string> = { GATEWAY_PORT: "4100", HOST: "127.0.0.1", LOG_LEVEL: "error", NODE_ENV: "test" };

  for (const name of ["MATCH", "BETTING", "WALLET", "SETTLEMENT", "SIMULATION", "ODDS", "RISK", "ANALYTICS", "IDENTITY", "EVENT"]) {
    env[`${name}_SERVICE_URL`] = url;
  }

  gateway = createApp(await loadGatewayConfig(env), {
    corsOrigins: ["http://localhost:4200"],
    actorCacheSeconds: 0,
    loginRateLimit: { limit: 0, windowSeconds: 60 },
  });

  await gateway.server.start();
  base = `http://127.0.0.1:${String(gateway.server.port)}/api/v1`;
});

afterAll(async () => {
  await gateway.server.stop();
  for (const close of gateway.onShutdown) await close();
  await new Promise((resolve) => upstream.close(resolve));
});

const auth = (token: string): Record<string, string> => ({ authorization: `Bearer ${token}` });

describe("gateway access control", () => {
  it("serves public routes without a token and forwards the query", async () => {
    const response = await fetch(`${base}/matches?leagueId=abc`);

    expect(response.status).toBe(200);
    expect(seen.at(-1)?.url).toBe("/api/v1/matches?leagueId=abc");
  });

  it("refuses a protected route without a token", async () => {
    const response = await fetch(`${base}/bets`);
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("answers SESSION_EXPIRED for an expired session and UNAUTHENTICATED for an unknown one", async () => {
    const expired = await fetch(`${base}/bets`, { headers: auth("expired-token-00000000000") });
    const unknown = await fetch(`${base}/bets`, { headers: auth("unknown-token-00000000000") });

    expect(((await expired.json()) as { error: { code: string } }).error.code).toBe("SESSION_EXPIRED");
    expect(((await unknown.json()) as { error: { code: string } }).error.code).toBe("UNAUTHENTICATED");
  });

  it("forwards the resolved actor and never a forged one", async () => {
    const response = await fetch(`${base}/bets`, {
      headers: {
        ...auth("customer-token-0000000000"),
        "x-betng-actor-kind": "ADMIN",
        "x-betng-actor-id": "99999999-9999-4999-8999-999999999999",
        "x-betng-permissions": "settings:write",
      },
    });

    const forwarded = seen.at(-1)?.headers ?? {};

    expect(response.status).toBe(200);
    expect(forwarded["x-betng-actor-kind"]).toBe("CUSTOMER");
    expect(forwarded["x-betng-actor-id"]).toBe("11111111-1111-4111-8111-111111111111");
    expect(forwarded["x-betng-permissions"]).toBe("");
    expect(forwarded.authorization).toBeUndefined();
  });

  it("drops forged actor headers on a public route", async () => {
    await fetch(`${base}/leagues`, { headers: { "x-betng-actor-kind": "ADMIN", "x-betng-actor-id": "x" } });

    expect(seen.at(-1)?.headers["x-betng-actor-kind"]).toBeUndefined();
  });

  it("keeps a customer out of shop and admin routes, and an admin out of betting", async () => {
    const asCustomer = await fetch(`${base}/admin/users`, { headers: auth("customer-token-0000000000") });
    const ticket = await fetch(`${base}/shop/tickets`, { method: "POST", body: "{}", headers: { ...auth("customer-token-0000000000"), "content-type": "application/json" } });
    const adminBet = await fetch(`${base}/bets`, { method: "POST", body: "{}", headers: { ...auth("super-token-0000000000000"), "content-type": "application/json" } });

    expect(asCustomer.status).toBe(403);
    expect(ticket.status).toBe(403);
    expect(adminBet.status).toBe(403);
  });

  it("requires the permission, not just the admin kind", async () => {
    const denied = await fetch(`${base}/admin/risk/limits`, { method: "PUT", body: "{}", headers: { ...auth("support-token-00000000000"), "content-type": "application/json" } });
    const allowed = await fetch(`${base}/admin/risk/limits`, { method: "PUT", body: "{}", headers: { ...auth("super-token-0000000000000"), "content-type": "application/json" } });

    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
  });

  it("carries the cashier's shop to the upstream", async () => {
    await fetch(`${base}/shop/tickets`, { headers: auth("cashier-token-00000000000") });

    const forwarded = seen.at(-1)?.headers ?? {};

    expect(forwarded["x-betng-shop-id"]).toBe("33333333-3333-4333-8333-333333333333");
    expect(decodeURIComponent(String(forwarded["x-betng-actor-name"]))).toBe("Tobi Ọ");
  });

  it("hands the bearer token only to identity's own session routes", async () => {
    const response = await fetch(`${base}/auth/logout`, { method: "POST", headers: auth("customer-token-0000000000") });

    expect(response.status).toBe(204);
    expect(seen.at(-1)?.headers.authorization).toBe("Bearer customer-token-0000000000");
    expect(seen.at(-1)?.headers["x-betng-actor-id"]).toBeUndefined();
  });

  it("has no route that sets a score or picks a winner", async () => {
    for (const path of ["/admin/matches/abc/result", "/admin/matches/abc/score", "/admin/matches/abc/winner", "/matches/abc/result"]) {
      const response = await fetch(`${base}${path}`, { method: "POST", body: "{}", headers: { ...auth("super-token-0000000000000"), "content-type": "application/json" } });

      expect([404, 405]).toContain(response.status);
    }
  });

  it("reports measured upstream health to an admin with health:read only", async () => {
    const denied = await fetch(`${base}/admin/health/services`, { headers: auth("support-token-00000000000") });
    const response = await fetch(`${base}/admin/health/services`, { headers: auth("super-token-0000000000000") });
    const body = (await response.json()) as { items: { service: string; status: string; version: string }[] };

    expect(denied.status).toBe(403);
    expect(body.items.map((item) => item.service)).toContain("identity");
    expect(body.items.find((item) => item.service === "match")?.version).toBe("9.9.9");
  });
});

describe("gateway CORS", () => {
  it("echoes a configured origin, including on errors, and nothing else", async () => {
    const ok = await fetch(`${base}/bets`, { headers: { origin: "http://localhost:4200" } });
    const other = await fetch(`${base}/leagues`, { headers: { origin: "https://evil.example" } });

    expect(ok.status).toBe(401);
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:4200");
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers a preflight", async () => {
    const response = await fetch(`${base}/bets`, { method: "OPTIONS", headers: { origin: "http://localhost:4200", "access-control-request-method": "POST" } });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toContain("authorization");
  });
});
