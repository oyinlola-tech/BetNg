import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, TEST_PORT } from "./support.js";
import type { Harness } from "./support.js";

const BASE = `http://127.0.0.1:${String(TEST_PORT)}`;
const API = `${BASE}/api/v1`;

interface Reply {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

interface Caller {
  readonly kind: "CUSTOMER" | "CASHIER" | "ADMIN";
  readonly id: string;
  readonly permissions?: readonly string[];
}

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness();
  await harness.app.server.start();
});

afterAll(async () => {
  await harness.app.server.stop();
  await harness.close();
});

function actorHeaders(caller: Caller | undefined): Record<string, string> {
  return caller === undefined
    ? {}
    : {
        "x-betng-actor-kind": caller.kind,
        "x-betng-actor-id": caller.id,
        "x-betng-actor-role": caller.kind === "ADMIN" ? "FINANCE" : caller.kind,
        "x-betng-actor-name": "Test%20Actor",
        "x-betng-permissions": (caller.permissions ?? []).join(","),
      };
}

async function call(
  method: string,
  url: string,
  caller?: Caller,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<Reply> {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json", ...actorHeaders(caller), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

function errorCode(reply: Reply): unknown {
  return (reply.body["error"] as { code?: unknown } | undefined)?.code;
}

const reader: Caller = { kind: "ADMIN", id: randomUUID(), permissions: ["settlement:read"] };
const operator: Caller = {
  kind: "ADMIN",
  id: randomUUID(),
  permissions: ["settlement:read", "settlement:operate"],
};
const unrelatedAdmin: Caller = { kind: "ADMIN", id: randomUUID(), permissions: ["users:read", "wallet:read"] };

const ADMIN_ROUTES = [
  { method: "GET", path: "/admin/settlements", write: false },
  { method: "POST", path: `/admin/settlements/${randomUUID()}/retry`, write: true, body: { reason: "Retry it" } },
  { method: "GET", path: "/admin/operator", write: false },
  { method: "GET", path: "/admin/operator/periods", write: false },
  { method: "POST", path: "/admin/operator/periods/close", write: true, body: { reason: "Close it" } },
  { method: "GET", path: "/admin/commission", write: false },
  { method: "GET", path: "/admin/commission/config", write: false },
  {
    method: "PUT",
    path: "/admin/commission/config",
    write: true,
    body: { shopId: randomUUID(), shopSharePercent: 10, reason: "Change it" },
  },
] as const;

describe("authorisation", () => {
  it.each(ADMIN_ROUTES)("$method $path needs an admin with the right permission", async (route) => {
    const body = "body" in route ? route.body : undefined;
    const url = `${API}${route.path}`;

    const anonymous = await call(route.method, url, undefined, body);

    expect(anonymous.status).toBe(401);
    expect(errorCode(anonymous)).toBe("UNAUTHENTICATED");

    for (const caller of [
      { kind: "CUSTOMER", id: randomUUID(), permissions: ["settlement:read", "settlement:operate"] },
      { kind: "CASHIER", id: randomUUID(), permissions: ["settlement:read", "settlement:operate"] },
      unrelatedAdmin,
      ...(route.write ? [reader] : []),
    ] satisfies Caller[]) {
      const refused = await call(route.method, url, caller, body);

      expect(refused.status).toBe(403);
      expect(errorCode(refused)).toBe("FORBIDDEN");
    }

    const allowed = await call(route.method, url, route.write ? operator : reader, body);

    expect([401, 403]).not.toContain(allowed.status);
  });

  it("serves no route that edits a settlement, a ledger row or a result", async () => {
    const betId = randomUUID();

    for (const [method, path] of [
      ["PUT", `/settlements/${betId}`],
      ["PATCH", `/settlements/${betId}`],
      ["DELETE", `/settlements/${betId}`],
      ["POST", "/settlements"],
      ["PATCH", `/admin/settlements/${betId}`],
      ["DELETE", `/admin/settlements/${betId}`],
      ["PUT", "/admin/operator"],
      ["PATCH", "/admin/operator/periods/SESSION-20260921-0001"],
      ["DELETE", "/admin/commission"],
      ["POST", "/admin/commission"],
      ["POST", `/admin/matches/${betId}/result`],
    ] as const) {
      const reply = await call(method, `${API}${path}`, operator, { payout: 1, outcome: "WON" });

      expect([404, 405]).toContain(reply.status);
    }
  });
});

describe("customer settlements", () => {
  it("shows a customer their own settlements only", async () => {
    const { fixtures } = harness;
    const alice = randomUUID();
    const bob = randomUUID();
    const matchId = await fixtures.completedMatch(2, 1);

    const aliceBet = await fixtures.bet({
      userId: alice,
      stake: 1_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "2.00" }],
    });
    const bobBet = await fixtures.bet({
      userId: bob,
      stake: 2_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "AWAY", odds: "3.00" }],
    });

    const settled = await call("POST", `${BASE}/internal/settlement/matches/${matchId}/settle`);

    expect(settled).toEqual({
      status: 200,
      body: { matchId, status: "COMPLETED", betsTotal: 2, betsSettled: 2, duplicate: false },
    });

    const aliceCaller: Caller = { kind: "CUSTOMER", id: alice };
    const mine = await call("GET", `${API}/settlements?matchId=${matchId}`, aliceCaller);

    expect(mine.status).toBe(200);
    expect(mine.body["items"]).toMatchObject([
      {
        betId: aliceBet.betId,
        outcome: "WON",
        payout: 2_000,
        currency: "NGN",
        selections: [{ selectionId: aliceBet.selectionIds[0], matchId, outcome: "WON" }],
      },
    ]);

    const everything = (await call("GET", `${API}/settlements`, aliceCaller)).body["items"] as {
      betId: string;
    }[];

    expect(everything.map((item) => item.betId)).toEqual([aliceBet.betId]);

    expect((await call("GET", `${API}/settlements/${aliceBet.betId}`, aliceCaller)).status).toBe(200);

    const foreign = await call("GET", `${API}/settlements/${bobBet.betId}`, aliceCaller);

    expect(foreign.status).toBe(404);
    expect(errorCode(foreign)).toBe("NOT_FOUND");
    expect((await call("GET", `${API}/settlements/${randomUUID()}`, aliceCaller)).status).toBe(404);

    const all = (await call("GET", `${API}/settlements?matchId=${matchId}`, reader)).body["items"] as {
      betId: string;
    }[];

    expect(all.map((item) => item.betId).sort()).toEqual([aliceBet.betId, bobBet.betId].sort());
    expect((await call("GET", `${API}/settlements/${bobBet.betId}`, reader)).status).toBe(200);
    expect((await call("GET", `${API}/settlements?status=LOST&matchId=${matchId}`, reader)).body["items"]).toMatchObject([
      { betId: bobBet.betId, outcome: "LOST", payout: 0 },
    ]);

    expect((await call("GET", `${API}/settlements`)).status).toBe(401);
    expect((await call("GET", `${API}/settlements`, unrelatedAdmin)).status).toBe(403);
    expect((await call("GET", `${API}/settlements`, { kind: "CASHIER", id: randomUUID() })).status).toBe(403);
  });

  it("validates query strings and path parameters", async () => {
    const customer: Caller = { kind: "CUSTOMER", id: randomUUID() };

    for (const url of [
      `${API}/settlements?status=PAID`,
      `${API}/settlements?matchId=not-a-uuid`,
      `${API}/settlements?limit=100000`,
      `${API}/settlements?userId=${randomUUID()}`,
      `${API}/settlements/not-a-uuid`,
    ]) {
      const reply = await call("GET", url, customer);

      expect(reply.status).toBe(422);
      expect(errorCode(reply)).toBe("VALIDATION_FAILED");
    }

    expect((await call("GET", `${API}/admin/commission?periodId=1%27%20OR%201=1`, reader)).status).toBe(422);
    expect((await call("GET", `${API}/admin/settlements?status=NOT_DUE`, reader)).status).toBe(422);
  });
});

describe("admin console", () => {
  it("lists settlements per bet, retries a failed one, and never takes an outcome from the caller", async () => {
    const { fixtures, peers } = harness;
    const customerId = await fixtures.customer("Ada Lovelace");
    const matchId = await fixtures.completedMatch(1, 0);

    const bet = await fixtures.bet({
      userId: customerId,
      stake: 4_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "1.75" }],
    });

    peers.walletFailure = new Error("wallet is down");

    const failed = await call("POST", `${BASE}/internal/settlement/matches/${matchId}/settle`);

    expect(failed.status).toBe(502);
    expect(errorCode(failed)).toBe("SETTLEMENT_FAILED");
    expect(JSON.stringify(failed.body)).not.toContain("wallet is down");

    const listed = (await call("GET", `${API}/admin/settlements?status=FAILED`, reader)).body["items"] as Record<
      string,
      unknown
    >[];
    const row = listed.find((item) => item["betId"] === bet.betId);

    expect(row).toMatchObject({
      id: bet.betId,
      owner: "user:Ada Lovelace",
      channel: "ONLINE",
      result: "1-0",
      stake: 4_000,
      payout: 7_000,
      status: "FAILED",
    });
    expect(typeof row?.["error"]).toBe("string");
    expect(typeof row?.["matchLabel"]).toBe("string");
    expect(typeof row?.["timestamp"]).toBe("string");

    const smuggled = await call("POST", `${API}/admin/settlements/${bet.betId}/retry`, operator, {
      reason: "Retry with a twist",
      outcome: "LOST",
      payout: 0,
    });

    expect(smuggled.status).toBe(422);

    const stillFailing = await call("POST", `${API}/admin/settlements/${bet.betId}/retry`, operator, {
      reason: "Retry while the wallet is down",
    });

    expect(stillFailing.status).toBe(502);

    peers.walletFailure = undefined;

    const retried = await call("POST", `${API}/admin/settlements/${bet.betId}/retry`, operator, {
      reason: "Wallet is back",
    });

    expect(retried.status).toBe(200);
    expect(retried.body).toMatchObject({ id: bet.betId, status: "COMPLETED", payout: 7_000 });
    expect(peers.credited.get(`settlement-payout:${bet.betId}`)?.amount).toBe(7_000);

    expect(
      peers.audits.some(
        (entry) =>
          entry.action === "settlement_completed" &&
          entry.entityId === matchId &&
          entry.actorId === operator.id &&
          entry.reason === "Wallet is back",
      ),
    ).toBe(true);

    const again = await call("POST", `${API}/admin/settlements/${bet.betId}/retry`, operator, {
      reason: "Once more",
    });

    expect(again.status).toBe(409);
    expect((await call("POST", `${API}/admin/settlements/${randomUUID()}/retry`, operator, { reason: "Nothing there" })).status).toBe(404);
  });

  it("serves the operator ledger, periods and commission over HTTP", async () => {
    const { fixtures } = harness;
    const shopId = await fixtures.shop("Ikeja Shop");
    const matchId = await fixtures.completedMatch(0, 3);

    await call("POST", `${API}/admin/operator/periods/close`, operator, { reason: "Fresh period" });

    await fixtures.bet({
      channel: "SHOP",
      shopId,
      stake: 50_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "AWAY", odds: "2.20" }],
    });

    await call("POST", `${BASE}/internal/settlement/matches/${matchId}/settle`);

    const live = await call("GET", `${API}/admin/operator`, reader);

    expect(live.status).toBe(200);
    expect(live.body["current"]).toMatchObject({
      period: { status: "OPEN", kind: "DAY" },
      grossStakes: 50_000,
      grossPayouts: 110_000,
      operatorResult: -60_000,
      operatorResultRate: -1.2,
      settledBets: 1,
      voidBets: 0,
      refundedStakes: 0,
    });

    const closed = await call("POST", `${API}/admin/operator/periods/close`, operator, {
      reason: "End of session",
      kind: "CUSTOM",
    });

    expect(closed.status).toBe(200);
    expect(closed.body["closed"]).toMatchObject({ operatorResult: -60_000, period: { status: "CLOSED" } });
    expect(closed.body["current"]).toMatchObject({ grossStakes: 0, operatorResult: 0, period: { kind: "CUSTOM" } });

    const periodId = (closed.body["closed"] as { period: { id: string } }).period.id;

    const periods = (await call("GET", `${API}/admin/operator/periods?limit=5`, reader)).body["items"] as {
      id: string;
    }[];

    expect(periods.map((period) => period.id)).toContain(periodId);
    expect(periods.length).toBeLessThanOrEqual(5);

    const commission = await call("GET", `${API}/admin/commission?periodId=${periodId}`, reader);

    expect(commission.body["items"]).toMatchObject([
      {
        periodId,
        shopId,
        shopName: "Ikeja Shop",
        grossOperatorResult: -60_000,
        shopShareAmount: 0,
        platformShareAmount: -60_000,
      },
    ]);

    const changed = await call("PUT", `${API}/admin/commission/config`, operator, {
      shopId,
      shopSharePercent: 22.5,
      reason: "New agreement",
    });

    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({ shopId, shopSharePercent: 22.5, updatedBy: operator.id });

    const config = await call("GET", `${API}/admin/commission/config`, reader);

    expect(config.body["default"]).toMatchObject({ shopSharePercent: expect.any(Number) as number });
    expect(config.body["shops"]).toEqual(
      expect.arrayContaining([expect.objectContaining({ shopId, shopSharePercent: 22.5 })]),
    );

    for (const body of [
      { shopSharePercent: 101, reason: "Too much" },
      { shopSharePercent: 10.123, reason: "Too precise" },
      { shopSharePercent: 10, reason: "ok" },
      { shopSharePercent: 10, reason: "Extra field", platformShareAmount: 5 },
    ]) {
      expect((await call("PUT", `${API}/admin/commission/config`, operator, body)).status).toBe(422);
    }
  });
});

describe("internal surface", () => {
  it("answers RPC with the platform error codes", async () => {
    const { fixtures } = harness;
    const live = await fixtures.match("IN_PLAY", "EVENTS_PUBLISHED");
    const done = await fixtures.completedMatch(1, 1);

    const rpc = async (procedure: string, payload: unknown): Promise<Record<string, unknown>> =>
      (
        await call("POST", `${BASE}/rpc`, undefined, {
          id: randomUUID(),
          procedure,
          payload,
          metadata: { requestId: "rpc-test" },
          timestamp: Date.now(),
        })
      ).body;

    expect(await rpc("settlement.settleMatch", { matchId: done })).toMatchObject({
      success: true,
      result: { matchId: done, status: "COMPLETED", betsTotal: 0, betsSettled: 0, duplicate: false },
    });
    expect(await rpc("settlement.settleMatch", { matchId: done })).toMatchObject({
      success: true,
      result: { duplicate: true },
    });
    expect(await rpc("settlement.settleMatch", { matchId: live })).toMatchObject({
      success: false,
      error: { code: "CONFLICT" },
    });
    expect(await rpc("settlement.settleMatch", { matchId: await fixtures.match() })).toMatchObject({
      success: false,
      error: { code: "SETTLEMENT_FAILED" },
    });
    expect(await rpc("settlement.voidMatch", { matchId: randomUUID(), reason: "No such match" })).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
    expect(await rpc("settlement.settleMatch", { matchId: done, payout: 1 })).toMatchObject({ success: false });
    expect(await rpc("settlement.voidMatch", { matchId: done })).toMatchObject({ success: false });
  });

  it("hides the internal settle route from callers without the service token", async () => {
    const token = "settlement-test-internal-token-0123456789";
    const matchId = await harness.fixtures.completedMatch(0, 0);
    const url = `${BASE}/internal/settlement/matches/${matchId}/settle`;

    process.env["INTERNAL_SERVICE_TOKEN"] = token;

    try {
      const bare = await call("POST", url);

      expect(bare.status).toBe(404);
      expect(errorCode(bare)).toBe("NOT_FOUND");
      expect((await call("POST", url, undefined, undefined, { "x-betng-internal-token": "wrong" })).status).toBe(404);

      const trusted = await call("POST", url, undefined, undefined, { "x-betng-internal-token": token });

      expect(trusted).toEqual({
        status: 200,
        body: { matchId, status: "COMPLETED", betsTotal: 0, betsSettled: 0, duplicate: false },
      });

      // Actor headers without the token are a forgery attempt, not an identity.
      expect((await call("GET", `${API}/admin/operator`, reader)).status).toBe(401);
      expect(
        (await call("GET", `${API}/admin/operator`, reader, undefined, { "x-betng-internal-token": token })).status,
      ).toBe(200);
    } finally {
      delete process.env["INTERNAL_SERVICE_TOKEN"];
    }
  });

  it("reports liveness", async () => {
    expect((await call("GET", `${BASE}/health`)).status).toBe(200);
  });
});
