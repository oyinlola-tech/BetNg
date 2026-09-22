import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createApp } from "../src/app.js";
import type { EventApp } from "../src/app.js";
import type { AuthOutcome, SessionAuthenticator } from "../src/clients/index.js";
import { loadEventConfig, loadLiveSettings } from "../src/configs/index.js";

const INTERNAL = `test-internal-${crypto.randomUUID()}`;
const previousInternal = process.env["INTERNAL_SERVICE_TOKEN"];

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SHOP = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MATCH = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const TOKENS = {
  alice: "alice-session-token-000001",
  aliceQuery: "alice-session-token-000002",
  aliceRevoked: "alice-session-token-000003",
  aliceTimer: "alice-session-token-000004",
  cashier: "cashier-session-token-0001",
  analyst: "analyst-session-token-0001",
};

class FakeIdentity implements SessionAuthenticator {
  public down = false;

  public readonly sessions = new Map<string, { kind: "CUSTOMER" | "CASHIER" | "ADMIN"; id: string; shopId?: string; permissions: string[] }>([
    [TOKENS.alice, { kind: "CUSTOMER", id: ALICE, permissions: [] }],
    [TOKENS.aliceQuery, { kind: "CUSTOMER", id: ALICE, permissions: [] }],
    [TOKENS.aliceRevoked, { kind: "CUSTOMER", id: ALICE, permissions: [] }],
    [TOKENS.aliceTimer, { kind: "CUSTOMER", id: ALICE, permissions: [] }],
    [TOKENS.cashier, { kind: "CASHIER", id: BOB, shopId: SHOP, permissions: ["tickets:sell"] }],
    [TOKENS.analyst, { kind: "ADMIN", id: BOB, permissions: ["risk:read"] }],
  ]);

  public async authenticate(token: string): Promise<AuthOutcome> {
    await new Promise((resolve) => setTimeout(resolve, 5));

    if (this.down) return { ok: false, reason: "UNAVAILABLE" };

    const found = this.sessions.get(token);

    return found === undefined
      ? { ok: false, reason: "UNAUTHENTICATED" }
      : { ok: true, session: { actor: { ...found, role: found.kind, name: "Test" }, expiresAt: Date.now() + 60_000 } };
  }
}

const identity = new FakeIdentity();
let app: EventApp;
let base: string;
const open: WebSocket[] = [];

interface Client {
  readonly socket: WebSocket;
  readonly frames: Record<string, unknown>[];
  send(frame: unknown): void;
  next(predicate: (frame: Record<string, unknown>) => boolean, timeoutMs?: number): Promise<Record<string, unknown>>;
  quiet(ms: number): Promise<Record<string, unknown>[]>;
}

async function connect(query = "", headers: Record<string, string> = {}): Promise<Client> {
  const socket = new WebSocket(`${base.replace("http", "ws")}/live${query}`, { headers });
  const frames: Record<string, unknown>[] = [];
  const waiters: { predicate: (frame: Record<string, unknown>) => boolean; resolve: (frame: Record<string, unknown>) => void }[] = [];

  socket.on("message", (data: Buffer) => {
    const frame = JSON.parse(data.toString()) as Record<string, unknown>;

    frames.push(frame);

    for (const waiter of [...waiters]) {
      if (waiter.predicate(frame)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(frame);
      }
    }
  });

  open.push(socket);

  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
    socket.once("unexpected-response", (_request, response) => reject(new Error(`HTTP ${String(response.statusCode)}`)));
  });

  const client: Client = {
    socket,
    frames,
    send: (frame) => socket.send(JSON.stringify(frame)),
    next: (predicate, timeoutMs = 2000) => {
      const seen = frames.find(predicate);

      if (seen !== undefined) {
        frames.splice(frames.indexOf(seen), 1);
        return Promise.resolve(seen);
      }

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("No matching frame")), timeoutMs);

        waiters.push({
          predicate,
          resolve: (frame) => {
            clearTimeout(timer);
            frames.splice(frames.indexOf(frame), 1);
            resolve(frame);
          },
        });
      });
    },
    quiet: async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));

      return frames.splice(0, frames.length);
    },
  };

  await client.next((frame) => frame["type"] === "WELCOME");

  return client;
}

async function rpc(procedure: string, payload: unknown): Promise<{ success: boolean; result?: Record<string, unknown> }> {
  const response = await fetch(`${base}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-betng-internal-token": INTERNAL },
    body: JSON.stringify({ id: crypto.randomUUID(), procedure, payload, metadata: {} }),
  });

  return (await response.json()) as { success: boolean; result?: Record<string, unknown> };
}

const isError = (code: string) => (frame: Record<string, unknown>) => frame["type"] === "ERROR" && frame["code"] === code;
const isSubscribed = (channel: string) => (frame: Record<string, unknown>) => frame["type"] === "SUBSCRIBED" && frame["channel"] === channel;
const isEvent = (channel: string) => (frame: Record<string, unknown>) => frame["type"] === "EVENT" && frame["channel"] === channel;

beforeAll(async () => {
  process.env["INTERNAL_SERVICE_TOKEN"] = INTERNAL;

  const config = await loadEventConfig({ NODE_ENV: "test", LOG_LEVEL: "fatal", HOST: "127.0.0.1", EVENT_PORT: "4108" });

  app = createApp(config, {
    authenticator: identity,
    settings: {
      ...loadLiveSettings({}),
      maxConnectionsPerIp: 12,
      revalidateMs: 150,
      trustedProxyHops: 1,
    },
  });

  await app.server.start();
  base = `http://127.0.0.1:${String(app.server.port)}`;
});

afterAll(async () => {
  for (const socket of open) socket.terminate();
  await app.server.stop();
  for (const close of app.onShutdown) await close();

  if (previousInternal === undefined) delete process.env["INTERNAL_SERVICE_TOKEN"];
  else process.env["INTERNAL_SERVICE_TOKEN"] = previousInternal;
});

describe("public channels", () => {
  it("serves match and system channels without a session", async () => {
    const client = await connect();

    client.send({ type: "SUBSCRIBE", channel: `match:${MATCH}` });
    client.send({ type: "SUBSCRIBE", channel: "system" });

    expect((await client.next(isSubscribed(`match:${MATCH}`)))["lastSequence"]).toBe(0);
    await client.next(isSubscribed("system"));

    await rpc("event.publishSignal", { channel: "system", type: "SYSTEM_STATUS_UPDATED" });

    const event = await client.next(isEvent("system"));

    expect((event["event"] as { type: string }).type).toBe("SYSTEM_STATUS_UPDATED");
  });

  it("refuses channels it does not serve", async () => {
    const client = await connect();

    client.send({ type: "SUBSCRIBE", channel: "wallet:not-a-uuid" });

    await client.next(isError("NOT_FOUND"));
  });
});

describe("private channels", () => {
  it("refuses a private subscribe without a session and delivers nothing to it", async () => {
    const client = await connect();

    client.send({ type: "SUBSCRIBE", channel: `wallet:${ALICE}` });
    await client.next(isError("UNAUTHENTICATED"));

    await rpc("event.publishSignal", { channel: `wallet:${ALICE}`, type: "WALLET_UPDATED" });

    expect((await client.quiet(100)).filter(isEvent(`wallet:${ALICE}`))).toHaveLength(0);
  });

  it("refuses another customer's channel and serves the caller's own, AUTH frame first", async () => {
    const client = await connect();

    client.send({ type: "AUTH", token: TOKENS.alice });
    client.send({ type: "SUBSCRIBE", channel: `wallet:${BOB}` });
    client.send({ type: "SUBSCRIBE", channel: `bets:${ALICE}` });

    await client.next(isError("FORBIDDEN"));
    await client.next(isSubscribed(`bets:${ALICE}`));

    const published = await rpc("event.publishSignal", { channel: `bets:${ALICE}`, type: "BET_UPDATED" });
    const event = await client.next(isEvent(`bets:${ALICE}`));

    expect(published.result?.["delivered"]).toBe(1);
    expect(event["event"]).toMatchObject({ type: "BET_UPDATED", sequence: 1 });
  });

  it("authenticates from ?access_token= and rejects an unknown token", async () => {
    const good = await connect(`?access_token=${TOKENS.aliceQuery}`);

    good.send({ type: "SUBSCRIBE", channel: `notifications:${ALICE}` });
    await good.next(isSubscribed(`notifications:${ALICE}`));

    const bad = await connect("?access_token=unknown-token-0000000000");

    await bad.next(isError("UNAUTHENTICATED"));
    bad.send({ type: "SUBSCRIBE", channel: `notifications:${ALICE}` });
    await bad.next(isError("UNAUTHENTICATED"));
  });

  it("scopes shop and admin channels to the cashier's shop and the admin's permission", async () => {
    const cashier = await connect();

    cashier.send({ type: "AUTH", token: TOKENS.cashier });
    cashier.send({ type: "SUBSCRIBE", channel: `shop:${SHOP}` });
    cashier.send({ type: "SUBSCRIBE", channel: `shop:${ALICE}` });
    await cashier.next(isSubscribed(`shop:${SHOP}`));
    await cashier.next(isError("FORBIDDEN"));

    const analyst = await connect();

    analyst.send({ type: "AUTH", token: TOKENS.analyst });
    analyst.send({ type: "SUBSCRIBE", channel: "risk" });
    analyst.send({ type: "SUBSCRIBE", channel: "admin" });
    await analyst.next(isSubscribed("risk"));
    await analyst.next(isError("FORBIDDEN"));
  });

  it("fails closed when identity cannot be reached", async () => {
    const client = await connect();

    client.send({ type: "AUTH", token: TOKENS.alice });
    await client.quiet(50);

    identity.down = true;

    try {
      client.send({ type: "SUBSCRIBE", channel: `user:${ALICE}` });
      await client.next(isError("UPSTREAM_UNAVAILABLE"));
    } finally {
      identity.down = false;
    }
  });
});

describe("revocation", () => {
  it("drops private subscriptions when identity signals a revoked session", async () => {
    const client = await connect();

    client.send({ type: "AUTH", token: TOKENS.aliceRevoked });
    client.send({ type: "SUBSCRIBE", channel: `wallet:${ALICE}` });
    client.send({ type: "SUBSCRIBE", channel: `match:${MATCH}` });
    await client.next(isSubscribed(`wallet:${ALICE}`));
    await client.next(isSubscribed(`match:${MATCH}`));

    const tokenHash = createHash("sha256").update(TOKENS.aliceRevoked).digest("hex");
    const revoked = await rpc("event.revokeSessions", { tokenHash });

    expect(revoked.result?.["revoked"]).toBe(1);
    await client.next(isError("SESSION_EXPIRED"));
    await client.next((frame) => frame["type"] === "UNSUBSCRIBED" && frame["channel"] === `wallet:${ALICE}`);

    await rpc("event.publishSignal", { channel: `wallet:${ALICE}`, type: "WALLET_UPDATED" });
    expect((await client.quiet(100)).filter(isEvent(`wallet:${ALICE}`))).toHaveLength(0);
  });

  it("drops private subscriptions on the periodic re-check once identity stops recognising the session", async () => {
    const client = await connect();

    client.send({ type: "AUTH", token: TOKENS.aliceTimer });
    client.send({ type: "SUBSCRIBE", channel: `wallet:${ALICE}` });
    await client.next(isSubscribed(`wallet:${ALICE}`));

    identity.sessions.delete(TOKENS.aliceTimer);

    await client.next(isError("UNAUTHENTICATED"), 3000);
    await client.next((frame) => frame["type"] === "UNSUBSCRIBED" && frame["channel"] === `wallet:${ALICE}`);
  });

  it("refuses revoke and publish calls without the internal token", async () => {
    const response = await fetch(`${base}/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "1", procedure: "event.revokeSessions", payload: { userId: ALICE }, metadata: {} }),
    });

    expect(response.status).toBe(404);
  });
});

describe("connection limits", () => {
  it("caps connections per client address", async () => {
    const address = { "x-forwarded-for": "198.51.100.30" };
    const first = await connect("", address);

    for (let index = 1; index < 12; index += 1) await connect("", address);

    await expect(connect("", address)).rejects.toThrow("HTTP 429");
    await expect(connect("", { "x-forwarded-for": "198.51.100.31" })).resolves.toBeDefined();

    first.socket.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(connect("", address)).resolves.toBeDefined();
  });

  it("closes a connection that sends an oversized frame", async () => {
    const client = await connect();
    const closed = new Promise<number>((resolve) => client.socket.once("close", (code: number) => resolve(code)));

    client.socket.send(JSON.stringify({ type: "SUBSCRIBE", channel: "x".repeat(8000) }));

    expect(await closed).toBe(1009);
  });

  it("closes a connection that floods frames", async () => {
    const client = await connect();
    const closed = new Promise<number>((resolve) => client.socket.once("close", (code: number) => resolve(code)));

    for (let index = 0; index < 80; index += 1) client.send({ type: "PONG" });

    expect(await closed).toBe(1008);
  });
});
