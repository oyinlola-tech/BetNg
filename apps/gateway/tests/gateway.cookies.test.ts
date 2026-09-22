import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { GatewayApp } from "../src/app.js";
import { loadGatewayConfig, loadGatewaySettings } from "../src/configs/index.js";

const ORIGIN = "http://localhost:4200";
const TOKEN = "cookie-session-token-000000000001";
const ROTATED = "cookie-session-token-000000000002";
const INTERNAL = `test-internal-${crypto.randomUUID()}`;
const previousInternal = process.env["INTERNAL_SERVICE_TOKEN"];

interface Seen {
  readonly method: string;
  readonly url: string;
  readonly authorization: string | undefined;
}

const seen: Seen[] = [];
let upstream: Server;
let cookieGateway: GatewayApp;
let bearerGateway: GatewayApp;
let cookieBase: string;
let bearerBase: string;

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString()));
  });
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await readBody(request);
  const url = request.url ?? "";
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString();

  response.setHeader("content-type", "application/json");

  if (url === "/rpc") {
    const frame = JSON.parse(body) as { id: string; payload: { token: string } };
    const known = frame.payload.token === TOKEN || frame.payload.token === ROTATED;

    response.end(
      JSON.stringify(
        known
          ? { id: frame.id, success: true, result: { kind: "CUSTOMER", id: "11111111-1111-4111-8111-111111111111", role: "CUSTOMER", name: "Ada", permissions: [], expiresAt } }
          : { id: frame.id, success: false, error: { code: "UNAUTHENTICATED", message: "no" } },
      ),
    );
    return;
  }

  seen.push({ method: request.method ?? "", url, authorization: request.headers.authorization });

  if (url === "/api/v1/auth/login") {
    response.end(JSON.stringify({ token: TOKEN, expiresAt, user: { id: "u" } }));
    return;
  }

  if (url === "/api/v1/auth/session/refresh") {
    response.end(JSON.stringify({ token: ROTATED, expiresAt }));
    return;
  }

  if (url === "/api/v1/auth/logout") {
    response.statusCode = 204;
    response.end();
    return;
  }

  response.end(JSON.stringify({ ok: true }));
}

function env(url: string, port: number): Record<string, string> {
  const values: Record<string, string> = { GATEWAY_PORT: String(port), HOST: "127.0.0.1", LOG_LEVEL: "fatal", NODE_ENV: "test" };

  for (const name of ["MATCH", "BETTING", "WALLET", "SETTLEMENT", "SIMULATION", "ODDS", "RISK", "ANALYTICS", "IDENTITY", "EVENT"]) {
    values[`${name}_SERVICE_URL`] = url;
  }

  return values;
}

function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

function cookieValue(cookies: readonly string[], name: string): string | undefined {
  const entry = cookies.find((cookie) => cookie.startsWith(`${name}=`));

  return entry?.slice(name.length + 1).split(";")[0];
}

async function signIn(): Promise<{ session: string; csrf: string; response: Response; body: { token: string } }> {
  const response = await fetch(`${cookieBase}/api/v1/auth/login`, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({ email: "a@b.test", password: "x" }),
  });
  const cookies = setCookies(response);

  return {
    response,
    body: (await response.json()) as { token: string },
    session: cookieValue(cookies, "betng_session") ?? "",
    csrf: cookieValue(cookies, "betng_csrf") ?? "",
  };
}

beforeAll(async () => {
  process.env["INTERNAL_SERVICE_TOKEN"] = INTERNAL;

  upstream = createServer((request, response) => void handle(request, response));
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${String((upstream.address() as AddressInfo).port)}`;
  const settings = { CORS_ORIGINS: ORIGIN, GATEWAY_ACTOR_CACHE_SECONDS: "0" };

  cookieGateway = createApp(await loadGatewayConfig(env(url, 4193)), loadGatewaySettings({ ...settings, GATEWAY_SESSION_COOKIE: "on" }));
  bearerGateway = createApp(await loadGatewayConfig(env(url, 4194)), loadGatewaySettings(settings));
  await cookieGateway.server.start();
  await bearerGateway.server.start();
  cookieBase = `http://127.0.0.1:${String(cookieGateway.server.port)}`;
  bearerBase = `http://127.0.0.1:${String(bearerGateway.server.port)}`;
});

afterAll(async () => {
  for (const app of [cookieGateway, bearerGateway].filter((entry): entry is GatewayApp => entry !== undefined)) {
    await app.server.stop();
    for (const close of app.onShutdown) await close();
  }

  await new Promise((resolve) => upstream.close(resolve));

  if (previousInternal === undefined) delete process.env["INTERNAL_SERVICE_TOKEN"];
  else process.env["INTERNAL_SERVICE_TOKEN"] = previousInternal;
});

describe("cookie sessions", () => {
  it("turns a browser sign-in into an HttpOnly session cookie and a readable CSRF cookie, and keeps the bearer out of the body", async () => {
    const { response, body, session, csrf } = await signIn();
    const cookies = setCookies(response);
    const sessionCookie = cookies.find((cookie) => cookie.startsWith("betng_session=")) ?? "";
    const csrfCookie = cookies.find((cookie) => cookie.startsWith("betng_csrf=")) ?? "";

    expect(response.status).toBe(200);
    expect(session).toBe(TOKEN);
    expect(body.token).not.toBe(TOKEN);
    expect(body.token.length).toBeGreaterThanOrEqual(16);
    expect(sessionCookie).toMatch(/; HttpOnly/);
    expect(sessionCookie).toMatch(/; Secure/);
    expect(sessionCookie).toMatch(/; SameSite=Lax/);
    expect(sessionCookie).toMatch(/Path=\//);
    expect(csrfCookie).not.toMatch(/HttpOnly/);
    expect(csrfCookie).toMatch(/; Secure/);
    expect(csrf).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("gives a client without a listed origin its bearer and no cookies", async () => {
    const response = await fetch(`${cookieBase}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.test", password: "x" }),
    });

    expect(((await response.json()) as { token: string }).token).toBe(TOKEN);
    expect(setCookies(response)).toEqual([]);
  });

  it("authenticates a read from the cookie alone", async () => {
    const { session } = await signIn();
    const response = await fetch(`${cookieBase}/api/v1/limits/summary`, { headers: { origin: ORIGIN, cookie: `betng_session=${session}` } });

    expect(response.status).toBe(200);
  });

  it("refuses an unsafe cookie request without the CSRF header, with a wrong one, or without the CSRF cookie", async () => {
    const { session, csrf } = await signIn();
    const attempt = (headers: Record<string, string>) =>
      fetch(`${cookieBase}/api/v1/limits`, { method: "PUT", headers: { origin: ORIGIN, "content-type": "application/json", ...headers }, body: "{}" });
    const before = seen.length;

    expect((await attempt({ cookie: `betng_session=${session}; betng_csrf=${csrf}` })).status).toBe(403);
    expect((await attempt({ cookie: `betng_session=${session}; betng_csrf=${csrf}`, "x-csrf-token": `${csrf.slice(0, -1)}x` })).status).toBe(403);
    expect((await attempt({ cookie: `betng_session=${session}`, "x-csrf-token": csrf })).status).toBe(403);
    expect((await attempt({ cookie: `betng_session=${session}; betng_csrf=${csrf}`, "x-csrf-token": `${csrf}${csrf}` })).status).toBe(403);
    expect(seen.length).toBe(before);

    const accepted = await attempt({ cookie: `betng_session=${session}; betng_csrf=${csrf}`, "x-csrf-token": csrf });

    expect(accepted.status).toBe(200);
  });

  it("needs no CSRF proof when the caller sends a bearer, which a browser never attaches on its own", async () => {
    const response = await fetch(`${cookieBase}/api/v1/limits`, {
      method: "PUT",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", cookie: "betng_csrf=zzz" },
      body: "{}",
    });

    expect(response.status).toBe(200);
  });

  it("rotates the session cookie on refresh and keeps the CSRF value", async () => {
    const { session, csrf } = await signIn();
    const response = await fetch(`${cookieBase}/api/v1/auth/session/refresh`, {
      method: "POST",
      headers: { origin: ORIGIN, cookie: `betng_session=${session}; betng_csrf=${csrf}`, "x-csrf-token": csrf },
    });
    const cookies = setCookies(response);

    expect(response.status).toBe(200);
    expect(cookieValue(cookies, "betng_session")).toBe(ROTATED);
    expect(cookieValue(cookies, "betng_csrf")).toBe(csrf);
    expect(((await response.json()) as { token: string }).token).not.toBe(ROTATED);
    expect(seen.at(-1)?.authorization).toBe(`Bearer ${session}`);
  });

  it("clears both cookies on sign-out, forwarding the cookie's session as the bearer", async () => {
    const { session, csrf } = await signIn();
    const response = await fetch(`${cookieBase}/api/v1/auth/logout`, {
      method: "POST",
      headers: { origin: ORIGIN, cookie: `betng_session=${session}; betng_csrf=${csrf}`, "x-csrf-token": csrf },
    });
    const cookies = setCookies(response);

    expect(response.status).toBe(204);
    expect(seen.at(-1)?.authorization).toBe(`Bearer ${session}`);
    expect(cookies.find((cookie) => cookie.startsWith("betng_session=;"))).toMatch(/Max-Age=0/);
    expect(cookies.find((cookie) => cookie.startsWith("betng_csrf=;"))).toMatch(/Max-Age=0/);
  });

  it("ignores session cookies entirely when cookie mode is off", async () => {
    const response = await fetch(`${bearerBase}/api/v1/limits/summary`, { headers: { origin: ORIGIN, cookie: `betng_session=${TOKEN}` } });
    const login = await fetch(`${bearerBase}/api/v1/auth/login`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: "{}" });

    expect(response.status).toBe(401);
    expect(setCookies(login)).toEqual([]);
    expect(login.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("allows credentials and the CSRF header in preflight only for a listed origin", async () => {
    const listed = await fetch(`${cookieBase}/api/v1/limits`, { method: "OPTIONS", headers: { origin: ORIGIN, "access-control-request-method": "PUT" } });
    const other = await fetch(`${cookieBase}/api/v1/limits`, { method: "OPTIONS", headers: { origin: "https://evil.example", "access-control-request-method": "PUT" } });

    expect(listed.headers.get("access-control-allow-credentials")).toBe("true");
    expect(listed.headers.get("access-control-allow-headers")).toContain("x-csrf-token");
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
    expect(other.headers.get("access-control-allow-credentials")).toBeNull();
  });
});

describe("CORS origins in production", () => {
  const production = { NODE_ENV: "production" };

  it("requires an explicit list", () => {
    expect(() => loadGatewaySettings(production)).toThrow(/CORS_ORIGINS/);
  });

  it("refuses http and local origins", () => {
    expect(() => loadGatewaySettings({ ...production, CORS_ORIGINS: "http://betng.ng" })).toThrow(/https/);
    expect(() => loadGatewaySettings({ ...production, CORS_ORIGINS: "https://localhost:4200" })).toThrow(/local origin/);
    expect(() => loadGatewaySettings({ ...production, CORS_ORIGINS: "https://127.0.0.1" })).toThrow(/local origin/);
    expect(() => loadGatewaySettings({ ...production, CORS_ORIGINS: "https://app.localhost" })).toThrow(/local origin/);
    expect(() => loadGatewaySettings({ ...production, CORS_ORIGINS: "https://betng.ng/path" })).toThrow(/https origin/);
  });

  it("accepts https origins and keeps the local defaults for development", () => {
    expect(loadGatewaySettings({ ...production, CORS_ORIGINS: "https://betng.ng, https://admin.betng.ng" }).corsOrigins).toEqual([
      "https://betng.ng",
      "https://admin.betng.ng",
    ]);
    expect(loadGatewaySettings({ NODE_ENV: "development" }).corsOrigins).toContain("http://localhost:4200");
  });

  it("validates the cookie domain and defaults cookie mode off", () => {
    expect(loadGatewaySettings({}).sessionCookie.enabled).toBe(false);
    expect(loadGatewaySettings({ GATEWAY_SESSION_COOKIE_DOMAIN: ".betng.ng" }).sessionCookie.domain).toBe("betng.ng");
    expect(() => loadGatewaySettings({ GATEWAY_SESSION_COOKIE_DOMAIN: "bad domain" })).toThrow(/GATEWAY_SESSION_COOKIE_DOMAIN/);
  });
});
