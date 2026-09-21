import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Bet } from "@betng/contracts";
import { startHarness } from "./harness.js";
import type { Harness } from "./harness.js";

interface ErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly data?: Record<string, unknown>;
  };
}

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness();
});

afterAll(async () => {
  await harness.stop();
});

beforeEach(() => {
  harness.risk.next = { decision: "ACCEPT", reason: "WITHIN_LIMIT", maxStake: 10_000_000 };
  harness.wallet.down = false;
  harness.failNextInsert = false;
  harness.lockUnavailable = false;
});

function fundedCustomer(balance = 1_000_000): string {
  const id = crypto.randomUUID();

  harness.wallet.balances.set(id, balance);

  return id;
}

async function betRows(userId: string): Promise<number> {
  const rows = await harness.admin.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM betting.bets WHERE user_id = ${userId}::uuid`;

  return rows[0]?.n ?? 0;
}

describe("POST /bets", () => {
  it("accepts a single, stores the database's price and debits once", async () => {
    const match = await harness.seedMatch();
    const userId = fundedCustomer();

    const reply = await harness.call<Bet>("POST", "/bets", {
      headers: harness.customer(userId),
      body: { userId: crypto.randomUUID(), selections: [match.leg(0)], stake: 50_000 },
    });

    expect(reply.status).toBe(201);
    expect(reply.body.userId).toBe(userId);
    expect(reply.body.potentialPayout).toBe(107_500);
    expect(reply.body.totalOdds).toBe(2.15);
    expect(reply.body.channel).toBe("ONLINE");
    expect(reply.body.status).toBe("PENDING");
    expect(reply.body.selections[0]).toMatchObject({
      odds: 2.15,
      oddsVersion: 3,
      selectionCode: "HOME",
      marketType: "MATCH_RESULT",
      marketLabel: "Match Result",
      outcome: "PENDING",
    });
    expect(reply.body.selections[0]?.matchLabel).toMatch(/^Home .* vs Away /);

    expect(harness.wallet.balanceOf(userId)).toBe(950_000);
    expect(harness.wallet.ledger.get(`${userId}:bet:${reply.body.id}`)).toMatchObject({
      type: "BET_STAKE",
      ownerType: "CUSTOMER",
      reference: reply.body.id,
    });

    const stored = await harness.admin.$queryRaw<
      { stake: bigint; payout: bigint; decision: string | null; odds: string; version: number }[]
    >`
      SELECT b.stake, b.potential_payout AS payout, b.risk_decision_id::text AS decision,
             s.odds::text AS odds, s.odds_version AS version
      FROM betting.bets b JOIN betting.bet_selections s ON s.bet_id = b.id
      WHERE b.id = ${reply.body.id}::uuid`;

    expect(stored[0]).toMatchObject({ stake: 50_000n, payout: 107_500n, odds: "2.15", version: 3 });
    expect(stored[0]?.decision).not.toBeNull();
  });

  it("prices a three-leg slip with integer arithmetic", async () => {
    const legs = await Promise.all([
      harness.seedMatch({ odds: ["2.15"] }),
      harness.seedMatch({ odds: ["3.40"] }),
      harness.seedMatch({ odds: ["1.85"] }),
    ]);
    const userId = fundedCustomer();

    const reply = await harness.call<Bet>("POST", "/bets", {
      headers: harness.customer(userId),
      body: { selections: legs.map((match) => match.leg(0)), stake: 10_000 },
    });

    expect(reply.status).toBe(201);
    expect(reply.body.potentialPayout).toBe(135_235);
    expect(reply.body.totalOdds).toBe(13.52);
    expect(reply.body.selections).toHaveLength(3);
  });

  it("refuses odds the client made up and names the current price", async () => {
    const match = await harness.seedMatch();
    const userId = fundedCustomer();

    const reply = await harness.call<ErrorBody>("POST", "/bets", {
      headers: harness.customer(userId),
      body: { selections: [{ ...match.leg(0), odds: 9.5 }], stake: 1000 },
    });

    expect(reply.status).toBe(409);
    expect(reply.body.error.code).toBe("ODDS_CHANGED");
    expect(reply.body.error.data).toEqual({
      current: [{ selectionId: match.selections[0]?.id, odds: 2.15, oddsVersion: 3 }],
    });
    expect(await betRows(userId)).toBe(0);
    expect(harness.wallet.balanceOf(userId)).toBe(1_000_000);
  });

  it("keeps the accepted price when the market reprices afterwards", async () => {
    const match = await harness.seedMatch();
    const userId = fundedCustomer();
    const headers = harness.customer(userId);

    const placed = await harness.call<Bet>("POST", "/bets", {
      headers,
      body: { selections: [match.leg(0)], stake: 2000 },
    });

    await harness.admin.$executeRaw`
      UPDATE odds.market_selections SET odds = 1.50 WHERE id = ${match.selections[0]?.id}::uuid`;
    await harness.admin.$executeRaw`
      UPDATE odds.markets SET odds_version = 4 WHERE id = ${match.marketId}::uuid`;

    const read = await harness.call<Bet>("GET", `/bets/${placed.body.id}`, { headers });

    expect(read.status).toBe(200);
    expect(read.body.selections[0]).toMatchObject({ odds: 2.15, oddsVersion: 3 });
    expect(read.body.potentialPayout).toBe(4300);

    const stale = await harness.call<ErrorBody>("POST", "/bets", {
      headers,
      body: { selections: [match.leg(0)], stake: 2000 },
    });

    expect(stale.body.error.code).toBe("ODDS_CHANGED");
    expect(stale.body.error.data).toEqual({
      current: [{ selectionId: match.selections[0]?.id, odds: 1.5, oddsVersion: 4 }],
    });
  });

  it.each([
    ["a suspended market", { marketStatus: "SUSPENDED" }],
    ["a closed market", { marketStatus: "CLOSED" }],
    ["a match past its lifecycle window", { lifecycle: "BETTING_CLOSED" }],
    ["a betting window that has ended", { closesInMs: -1000 }],
  ])("answers MARKET_CLOSED for %s", async (_name, options) => {
    const match = await harness.seedMatch(options);
    const userId = fundedCustomer();

    const reply = await harness.call<ErrorBody>("POST", "/bets", {
      headers: harness.customer(userId),
      body: { selections: [match.leg(0)], stake: 1000 },
    });

    expect(reply.status).toBe(409);
    expect(reply.body.error.code).toBe("MARKET_CLOSED");
    expect(harness.risk.calls.some((call) => call.actor.id === userId)).toBe(false);
    expect(await betRows(userId)).toBe(0);
  });

  it("answers INVALID_BET for an unknown selection and a selection of another market", async () => {
    const match = await harness.seedMatch();
    const other = await harness.seedMatch();
    const headers = harness.customer(fundedCustomer());

    const unknown = await harness.call<ErrorBody>("POST", "/bets", {
      headers,
      body: { selections: [{ ...match.leg(0), selectionId: crypto.randomUUID() }], stake: 1000 },
    });
    const crossed = await harness.call<ErrorBody>("POST", "/bets", {
      headers,
      body: { selections: [{ ...match.leg(0), selectionId: other.selections[0]?.id }], stake: 1000 },
    });

    expect(unknown.status).toBe(422);
    expect(unknown.body.error.code).toBe("INVALID_BET");
    expect(crossed.body.error.code).toBe("INVALID_BET");
  });

  it("answers INVALID_BET for two legs on one match and for more than 20 legs", async () => {
    const match = await harness.seedMatch();
    const headers = harness.customer(fundedCustomer());

    const doubled = await harness.call<ErrorBody>("POST", "/bets", {
      headers,
      body: { selections: [match.leg(0), match.leg(1)], stake: 1000 },
    });
    const oversized = await harness.call<ErrorBody>("POST", "/bets", {
      headers,
      body: { selections: Array.from({ length: 21 }, () => match.leg(0)), stake: 1000 },
    });

    expect(doubled.status).toBe(422);
    expect(doubled.body.error.code).toBe("INVALID_BET");
    expect(oversized.status).toBe(422);
    expect(oversized.body.error.code).toBe("INVALID_BET");
  });

  it("answers STAKE_LIMITED with the maximum stake when risk limits", async () => {
    const match = await harness.seedMatch();
    const userId = fundedCustomer();

    harness.risk.next = { decision: "LIMIT", reason: "STAKE_LIMIT", maxStake: 25_000 };

    const reply = await harness.call<ErrorBody>("POST", "/bets", {
      headers: harness.customer(userId),
      body: { selections: [match.leg(0)], stake: 90_000 },
    });

    expect(reply.status).toBe(409);
    expect(reply.body.error.code).toBe("STAKE_LIMITED");
    expect(reply.body.error.data).toEqual({ maxStake: 25_000 });
    expect(await betRows(userId)).toBe(0);
    expect(harness.wallet.balanceOf(userId)).toBe(1_000_000);
  });

  it("answers RISK_REJECTED, and MARKET_CLOSED when that is risk's reason", async () => {
    const match = await harness.seedMatch();
    const userId = fundedCustomer();
    const request = {
      headers: harness.customer(userId),
      body: { selections: [match.leg(0)], stake: 1000 },
    };

    harness.risk.next = { decision: "REJECT", reason: "EXPOSURE_LIMIT", maxStake: 0 };
    const rejected = await harness.call<ErrorBody>("POST", "/bets", request);

    harness.risk.next = { decision: "REJECT", reason: "MARKET_SUSPENDED", maxStake: 0 };
    const suspended = await harness.call<ErrorBody>("POST", "/bets", request);

    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe("RISK_REJECTED");
    expect(suspended.body.error.code).toBe("MARKET_CLOSED");
    expect(await betRows(userId)).toBe(0);
  });

  it("fails closed when risk is down: no bet row and no wallet call", async () => {
    const match = await harness.seedMatch();
    const userId = fundedCustomer();

    harness.risk.next = "DOWN";

    const reply = await harness.call<ErrorBody>("POST", "/bets", {
      headers: harness.customer(userId),
      body: { selections: [match.leg(0)], stake: 1000 },
    });

    expect(reply.status).toBe(503);
    expect(reply.body.error.code).toBe("RISK_UNAVAILABLE");
    expect(await betRows(userId)).toBe(0);
    expect(harness.wallet.calls.some((call) => call.ownerId === userId)).toBe(false);
  });

  it("writes no bet when the wallet cannot cover the stake", async () => {
    const match = await harness.seedMatch();
    const userId = fundedCustomer(500);

    const reply = await harness.call<ErrorBody>("POST", "/bets", {
      headers: harness.customer(userId),
      body: { selections: [match.leg(0)], stake: 1000 },
    });

    expect(reply.status).toBe(422);
    expect(reply.body.error.code).toBe("INSUFFICIENT_FUNDS");
    expect(await betRows(userId)).toBe(0);
    expect(harness.wallet.balanceOf(userId)).toBe(500);
  });

  it("writes no bet when the wallet is unreachable", async () => {
    const match = await harness.seedMatch();
    const userId = fundedCustomer();

    harness.wallet.down = true;

    const reply = await harness.call<ErrorBody>("POST", "/bets", {
      headers: harness.customer(userId),
      body: { selections: [match.leg(0)], stake: 1000 },
    });

    expect(reply.status).toBe(503);
    expect(reply.body.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(await betRows(userId)).toBe(0);
  });

  it("never places unlocked: no lock, no risk call, no debit, no bet", async () => {
    const match = await harness.seedMatch();
    const userId = fundedCustomer();

    harness.lockUnavailable = true;

    const reply = await harness.call<ErrorBody>("POST", "/bets", {
      headers: harness.customer(userId),
      body: { selections: [match.leg(0)], stake: 1000 },
    });

    expect(reply.status).toBe(503);
    expect(reply.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(harness.risk.calls.some((call) => call.actor.id === userId)).toBe(false);
    expect(harness.wallet.calls.some((call) => call.ownerId === userId)).toBe(false);
    expect(await betRows(userId)).toBe(0);
  });

  it("returns the stake when the bet cannot be written", async () => {
    const match = await harness.seedMatch();
    const userId = fundedCustomer();

    harness.failNextInsert = true;

    const reply = await harness.call<ErrorBody>("POST", "/bets", {
      headers: harness.customer(userId),
      body: { selections: [match.leg(0)], stake: 7000 },
    });

    expect(reply.status).toBe(500);
    expect(reply.body.error.message).not.toContain("simulated");
    expect(await betRows(userId)).toBe(0);
    expect(harness.wallet.balanceOf(userId)).toBe(1_000_000);

    const refund = harness.wallet.calls.find(
      (call) => call.ownerId === userId && call.direction === "credit",
    );

    expect(refund).toMatchObject({ type: "BET_REFUND", amount: 7000 });
    expect(refund?.idempotencyKey).toMatch(/^bet-rollback:/);
  });

  it("replays an idempotency key: same bet, one debit", async () => {
    const match = await harness.seedMatch();
    const userId = fundedCustomer();
    const request = {
      headers: { ...harness.customer(userId), "idempotency-key": `slip-${crypto.randomUUID()}` },
      body: { selections: [match.leg(0)], stake: 3000 },
    };

    const [first, second] = await Promise.all([
      harness.call<Bet>("POST", "/bets", request),
      harness.call<Bet>("POST", "/bets", request),
    ]);
    const third = await harness.call<Bet>("POST", "/bets", request);

    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(third.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(third.body.id).toBe(first.body.id);
    expect(await betRows(userId)).toBe(1);
    expect(harness.wallet.balanceOf(userId)).toBe(997_000);
  });

  it("does not let one customer's key return another customer's bet", async () => {
    const match = await harness.seedMatch();
    const key = `slip-${crypto.randomUUID()}`;
    const alice = fundedCustomer();
    const bob = fundedCustomer();
    const body = { selections: [match.leg(0)], stake: 1000 };

    const first = await harness.call<Bet>("POST", "/bets", {
      headers: { ...harness.customer(alice), "idempotency-key": key },
      body,
    });
    const second = await harness.call<Bet>("POST", "/bets", {
      headers: { ...harness.customer(bob), "idempotency-key": key },
      body,
    });

    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);
    expect(second.body.userId).toBe(bob);
  });

  it("refuses an admin, a cashier and an anonymous caller", async () => {
    const match = await harness.seedMatch();
    const shop = await harness.seedShop();
    const body = { selections: [match.leg(0)], stake: 1000 };

    const admin = await harness.call<ErrorBody>("POST", "/bets", { headers: harness.admin_(), body });
    const cashier = await harness.call<ErrorBody>("POST", "/bets", { headers: harness.cashier(shop), body });
    const nobody = await harness.call<ErrorBody>("POST", "/bets", { body });
    const adminTicket = await harness.call<ErrorBody>("POST", "/shop/tickets", {
      headers: harness.admin_(["tickets:sell"]),
      body,
    });

    const forged = await harness.call<ErrorBody>("POST", "/bets", {
      headers: harness.customer(fundedCustomer()),
      body,
      asGateway: false,
    });

    expect(forged.status).toBe(401);
    expect(admin.status).toBe(403);
    expect(cashier.status).toBe(403);
    expect(nobody.status).toBe(401);
    expect(adminTicket.status).toBe(403);
  });
});

describe("GET /bets", () => {
  it("shows a customer only their own bets, newest first", async () => {
    const match = await harness.seedMatch();
    const other = await harness.seedMatch();
    const alice = fundedCustomer();
    const bob = fundedCustomer();

    const first = await harness.call<Bet>("POST", "/bets", {
      headers: harness.customer(alice),
      body: { selections: [match.leg(0)], stake: 1000 },
    });
    const second = await harness.call<Bet>("POST", "/bets", {
      headers: harness.customer(alice),
      body: { selections: [other.leg(1)], stake: 1500 },
    });
    await harness.call<Bet>("POST", "/bets", {
      headers: harness.customer(bob),
      body: { selections: [match.leg(2)], stake: 2000 },
    });

    const mine = await harness.call<{ items: Bet[] }>("GET", `/bets?userId=${bob}`, {
      headers: harness.customer(alice),
    });

    expect(mine.body.items.map((bet) => bet.id)).toEqual([second.body.id, first.body.id]);

    const none = await harness.call<{ items: Bet[] }>("GET", "/bets?status=WON", {
      headers: harness.customer(alice),
    });

    expect(none.body.items).toEqual([]);

    const asAdmin = await harness.call<{ items: Bet[] }>("GET", `/bets?userId=${bob}`, {
      headers: harness.admin_(),
    });
    const asAdminWithoutPermission = await harness.call<ErrorBody>("GET", `/bets?userId=${bob}`, {
      headers: harness.admin_([]),
    });

    expect(asAdmin.body.items).toHaveLength(1);
    expect(asAdminWithoutPermission.status).toBe(403);
  });

  it("answers 404 for another customer's bet, exactly as for a missing one", async () => {
    const match = await harness.seedMatch();
    const alice = fundedCustomer();

    const placed = await harness.call<Bet>("POST", "/bets", {
      headers: harness.customer(alice),
      body: { selections: [match.leg(0)], stake: 1000 },
    });

    const stranger = harness.customer(fundedCustomer());
    const theirs = await harness.call<ErrorBody>("GET", `/bets/${placed.body.id}`, { headers: stranger });
    const missing = await harness.call<ErrorBody>("GET", `/bets/${crypto.randomUUID()}`, { headers: stranger });
    const malformed = await harness.call<ErrorBody>("GET", "/bets/not-a-uuid", { headers: stranger });

    expect(theirs.status).toBe(404);
    expect(theirs.body.error).toMatchObject({ code: missing.body.error.code, message: missing.body.error.message });
    expect(malformed.status).toBe(404);
  });
});
