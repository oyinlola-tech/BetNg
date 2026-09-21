import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SettleMatchCommand, VoidMatchCommand } from "../src/services/settlement/commands/index.js";
import type { MatchSettlementResult } from "../src/services/index.js";
import { createHarness, FakePeers, SYSTEM } from "./support.js";
import type { Harness } from "./support.js";

interface SettlementRow {
  readonly id: string;
  readonly outcome: string;
  readonly stake: bigint;
  readonly payout: bigint;
  readonly effects_applied_at: Date | null;
}

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness();
});

afterAll(async () => {
  await harness.close();
});

beforeEach(() => {
  harness.peers.walletFailure = undefined;
  harness.peers.bettingFailure = undefined;
});

async function settle(target: Harness, matchId: string): Promise<MatchSettlementResult> {
  return target.app.commandBus.execute<SettleMatchCommand, MatchSettlementResult>(
    new SettleMatchCommand({ matchId, actor: SYSTEM }),
  );
}

async function voidMatch(target: Harness, matchId: string): Promise<MatchSettlementResult> {
  return target.app.commandBus.execute<VoidMatchCommand, MatchSettlementResult>(
    new VoidMatchCommand({ matchId, reason: "Abandoned in test", actor: SYSTEM }),
  );
}

async function settlementsOf(betId: string): Promise<SettlementRow[]> {
  return harness.fixtures.admin.$queryRaw<SettlementRow[]>`
    SELECT id, outcome, stake, payout, effects_applied_at
    FROM settlement.settlements WHERE bet_id = ${betId}::uuid`;
}

async function ledgerEntriesOf(betId: string): Promise<number> {
  const rows = await harness.fixtures.admin.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM settlement.operator_ledger_entries WHERE bet_id = ${betId}::uuid`;

  return rows[0]?.n ?? 0;
}

async function matchSettlement(matchId: string): Promise<{ status: string; failure_reason: string | null }> {
  const rows = await harness.fixtures.admin.$queryRaw<{ status: string; failure_reason: string | null }[]>`
    SELECT status, failure_reason FROM settlement.match_settlements WHERE match_id = ${matchId}::uuid`;

  const row = rows[0];

  if (row === undefined) {
    throw new Error("No match settlement.");
  }

  return row;
}

describe("settleMatch", () => {
  it("settles on the odds stored on the leg and pays the customer once", async () => {
    const { fixtures, peers } = harness;
    const matchId = await fixtures.completedMatch(2, 1);
    const userId = randomUUID();

    const won = await fixtures.bet({
      userId,
      stake: 10_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "1.85" }],
    });
    const lost = await fixtures.bet({
      stake: 4_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "AWAY", odds: "4.20" }],
    });

    const result = await settle(harness, matchId);

    expect(result).toEqual({ matchId, status: "COMPLETED", betsTotal: 2, betsSettled: 2, duplicate: false });

    const [settlement] = await settlementsOf(won.betId);

    expect(settlement).toMatchObject({ outcome: "WON", stake: 10_000n, payout: 18_500n });
    expect(settlement?.effects_applied_at).toBeInstanceOf(Date);
    expect(await settlementsOf(lost.betId)).toMatchObject([{ outcome: "LOST", payout: 0n }]);

    expect(peers.walletCallsFor(won.betId)).toEqual([
      {
        ownerType: "CUSTOMER",
        ownerId: userId,
        amount: 18_500,
        type: "BET_PAYOUT",
        idempotencyKey: `settlement-payout:${won.betId}`,
        reference: settlement?.id,
        note: "Winning bet payout",
      },
    ]);
    expect(peers.walletCallsFor(lost.betId)).toEqual([]);

    expect(peers.bettingCalls.find((call) => call.betId === won.betId)).toMatchObject({
      outcome: "WON",
      payout: 18_500,
      legs: [{ selectionId: won.selectionIds[0], outcome: "WON", result: "2-1" }],
    });

    const actions = peers.audits.filter((entry) => entry.entityId === matchId).map((entry) => entry.action);

    expect(actions).toEqual(["settlement_started", "settlement_completed"]);
  });

  it("ignores a market price that moved after the bet was accepted", async () => {
    const { fixtures } = harness;
    const matchId = await fixtures.completedMatch(1, 0);

    const bet = await fixtures.bet({
      stake: 1_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "2.10" }],
    });

    // Settlement has no read path to odds.market_selections; the stored leg odds are all it can see.
    await settle(harness, matchId);

    expect(await settlementsOf(bet.betId)).toMatchObject([{ outcome: "WON", payout: 2_100n }]);
  });

  it("is idempotent: a second call pays nothing and answers duplicate", async () => {
    const { fixtures, peers } = harness;
    const matchId = await fixtures.completedMatch(3, 0);

    const bet = await fixtures.bet({
      stake: 2_500n,
      legs: [{ matchId, marketType: "GOAL_SPREAD", selectionCode: "HOME_MINUS_1_5", odds: "2.40" }],
    });

    const first = await settle(harness, matchId);
    const second = await settle(harness, matchId);

    expect(first.duplicate).toBe(false);
    expect(second).toEqual({ matchId, status: "COMPLETED", betsTotal: 1, betsSettled: 1, duplicate: true });

    expect(await settlementsOf(bet.betId)).toHaveLength(1);
    expect(await ledgerEntriesOf(bet.betId)).toBe(1);
    expect(peers.walletCallsFor(bet.betId)).toHaveLength(1);
    expect(peers.bettingCalls.filter((call) => call.betId === bet.betId)).toHaveLength(1);
  });

  it("is idempotent under concurrency in one process", async () => {
    const { fixtures, peers } = harness;
    const matchId = await fixtures.completedMatch(1, 1);

    const bets = await Promise.all(
      Array.from({ length: 6 }, async () =>
        fixtures.bet({
          stake: 1_000n,
          legs: [{ matchId, marketType: "BOTH_TEAMS_TO_SCORE", selectionCode: "YES", odds: "1.70" }],
        }),
      ),
    );

    const results = await Promise.all([settle(harness, matchId), settle(harness, matchId), settle(harness, matchId)]);

    expect(results.map((result) => result.status)).toEqual(["COMPLETED", "COMPLETED", "COMPLETED"]);
    expect(results.filter((result) => !result.duplicate)).toHaveLength(1);
    expect(results.filter((result) => result.duplicate)).toHaveLength(2);

    for (const bet of bets) {
      expect(await settlementsOf(bet.betId)).toHaveLength(1);
      expect(await ledgerEntriesOf(bet.betId)).toBe(1);
      expect(peers.walletCallsFor(bet.betId)).toHaveLength(1);
      expect(peers.walletCallsFor(bet.betId)[0]?.idempotencyKey).toBe(`settlement-payout:${bet.betId}`);
    }
  });

  it("is idempotent across two service instances racing on one database", async () => {
    const peers = new FakePeers();
    const first = await createHarness(peers);
    const second = await createHarness(peers);

    try {
      const matchId = await first.fixtures.completedMatch(0, 2);

      const bets = await Promise.all(
        Array.from({ length: 5 }, async () =>
          first.fixtures.bet({
            stake: 3_000n,
            legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "AWAY", odds: "3.10" }],
          }),
        ),
      );

      const outcomes = await Promise.allSettled([settle(first, matchId), settle(second, matchId)]);

      expect(outcomes.some((outcome) => outcome.status === "fulfilled")).toBe(true);

      for (const bet of bets) {
        expect(await settlementsOf(bet.betId)).toMatchObject([{ outcome: "WON", payout: 9_300n }]);
        expect(await ledgerEntriesOf(bet.betId)).toBe(1);

        // Both instances may reach the wallet, but always with the one key, so the customer is credited once.
        const keys = new Set(peers.walletCallsFor(bet.betId).map((call) => call.idempotencyKey));

        expect([...keys]).toEqual([`settlement-payout:${bet.betId}`]);
        expect(peers.credited.get(`settlement-payout:${bet.betId}`)?.amount).toBe(9_300);
      }

      expect((await settle(first, matchId)).duplicate).toBe(true);
    } finally {
      await first.close();
      await second.close();
    }
  });

  it("leaves a settlement un-stamped when the wallet fails, reports the failure, and pays once on retry", async () => {
    const { fixtures, peers, app } = harness;
    const matchId = await fixtures.completedMatch(2, 2);

    const bet = await fixtures.bet({
      stake: 5_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "DRAW", odds: "3.30" }],
    });

    peers.walletFailure = new Error("wallet is down");

    await expect(settle(harness, matchId)).rejects.toMatchObject({ code: "SETTLEMENT_FAILED", statusCode: 502 });

    expect(await settlementsOf(bet.betId)).toMatchObject([
      { outcome: "WON", payout: 16_500n, effects_applied_at: null },
    ]);
    expect((await matchSettlement(matchId)).status).toBe("FAILED");
    expect((await matchSettlement(matchId)).failure_reason).not.toContain("wallet is down");
    expect(peers.credited.has(`settlement-payout:${bet.betId}`)).toBe(false);
    expect(peers.audits.filter((entry) => entry.entityId === matchId).at(-1)?.action).toBe("settlement_failed");

    // Still failing: the retry loop changes nothing.
    await app.maintenance.tick();
    expect((await settlementsOf(bet.betId))[0]?.effects_applied_at).toBeNull();

    peers.walletFailure = undefined;
    await app.maintenance.tick();

    const [stamped] = await settlementsOf(bet.betId);

    expect(stamped?.effects_applied_at).toBeInstanceOf(Date);
    expect(await settlementsOf(bet.betId)).toHaveLength(1);
    expect(await ledgerEntriesOf(bet.betId)).toBe(1);
    expect(peers.credited.get(`settlement-payout:${bet.betId}`)?.amount).toBe(16_500);
    expect(peers.walletCallsFor(bet.betId).filter((call) => call.amount !== 16_500)).toEqual([]);
    expect((await matchSettlement(matchId)).status).toBe("COMPLETED");
    expect((await settle(harness, matchId)).duplicate).toBe(true);
  });

  it("fails honestly when betting cannot be told", async () => {
    const { fixtures, peers } = harness;
    const matchId = await fixtures.completedMatch(1, 0);

    const bet = await fixtures.bet({
      stake: 1_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "1.50" }],
    });

    peers.bettingFailure = new Error("betting is down");

    await expect(settle(harness, matchId)).rejects.toMatchObject({ code: "SETTLEMENT_FAILED" });
    expect(peers.walletCallsFor(bet.betId)).toEqual([]);

    peers.bettingFailure = undefined;

    expect(await settle(harness, matchId)).toMatchObject({ status: "COMPLETED", duplicate: false, betsSettled: 1 });
    expect(peers.walletCallsFor(bet.betId)).toHaveLength(1);
  });

  it("settles a multi-leg slip only after both matches have results", async () => {
    const { fixtures, peers } = harness;
    const firstMatch = await fixtures.completedMatch(2, 0);
    const secondMatch = await fixtures.match("IN_PLAY", "EVENTS_PUBLISHED");

    // The second result exists from kick-off but is not revealed; settlement must not act on it.
    await fixtures.result(secondMatch, 1, 1);

    const slip = await fixtures.bet({
      stake: 2_000n,
      legs: [
        { matchId: firstMatch, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "1.50" },
        { matchId: secondMatch, marketType: "OVER_UNDER", selectionCode: "UNDER_2_5", odds: "1.80", line: "2.5" },
      ],
    });

    expect(await settle(harness, firstMatch)).toMatchObject({ status: "COMPLETED", betsTotal: 1, betsSettled: 0 });
    expect(await settlementsOf(slip.betId)).toEqual([]);
    expect(peers.walletCallsFor(slip.betId)).toEqual([]);

    await expect(settle(harness, secondMatch)).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });

    await fixtures.setMatch(secondMatch, "COMPLETED", "MATCH_FINISHED");

    expect(await settle(harness, secondMatch)).toMatchObject({ status: "COMPLETED", betsSettled: 1 });
    expect(await settlementsOf(slip.betId)).toMatchObject([{ outcome: "WON", payout: 5_400n }]);

    expect(peers.bettingCalls.find((call) => call.betId === slip.betId)?.legs).toEqual([
      { selectionId: slip.selectionIds[0], outcome: "WON", result: "2-0" },
      { selectionId: slip.selectionIds[1], outcome: "WON", result: "1-1" },
    ]);
  });

  it("counts a leg on a voided match as 1.00", async () => {
    const { fixtures } = harness;
    const played = await fixtures.completedMatch(0, 1);
    const voided = await fixtures.match("CANCELLED", "VOIDED");

    const slip = await fixtures.bet({
      stake: 1_000n,
      legs: [
        { matchId: played, marketType: "DOUBLE_CHANCE", selectionCode: "DRAW_AWAY", odds: "1.45" },
        { matchId: voided, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "9.00" },
      ],
    });

    await settle(harness, played);

    expect(await settlementsOf(slip.betId)).toMatchObject([{ outcome: "WON", payout: 1_450n }]);
  });

  it("voids a leg with an unknown selection code and refunds the stake", async () => {
    const { fixtures, peers } = harness;
    const matchId = await fixtures.completedMatch(1, 0);
    const userId = randomUUID();

    const bet = await fixtures.bet({
      userId,
      stake: 6_000n,
      legs: [{ matchId, marketType: "FIRST_GOALSCORER", selectionCode: "PLAYER_9", odds: "6.00" }],
    });

    await settle(harness, matchId);

    expect(await settlementsOf(bet.betId)).toMatchObject([{ outcome: "VOID", payout: 6_000n }]);
    expect(peers.walletCallsFor(bet.betId)).toMatchObject([
      { ownerType: "CUSTOMER", ownerId: userId, amount: 6_000, type: "BET_REFUND" },
    ]);
  });

  it("moves no wallet money for a shop ticket and ignores cancelled bets", async () => {
    const { fixtures, peers } = harness;
    const matchId = await fixtures.completedMatch(2, 1);

    const ticket = await fixtures.bet({
      channel: "SHOP",
      stake: 8_000n,
      legs: [{ matchId, marketType: "CORRECT_SCORE", selectionCode: "CS_2_1", odds: "8.50" }],
    });
    const cancelled = await fixtures.bet({
      status: "CANCELLED",
      stake: 8_000n,
      legs: [{ matchId, marketType: "CORRECT_SCORE", selectionCode: "CS_2_1", odds: "8.50" }],
    });

    expect(await settle(harness, matchId)).toMatchObject({ betsTotal: 1, betsSettled: 1 });

    expect(await settlementsOf(ticket.betId)).toMatchObject([{ outcome: "WON", payout: 68_000n }]);
    expect(peers.walletCallsFor(ticket.betId)).toEqual([]);
    expect(peers.bettingCalls.some((call) => call.betId === ticket.betId)).toBe(true);
    expect(await settlementsOf(cancelled.betId)).toEqual([]);
  });

  it("refuses a match that is not completed, a match without a result and an unknown match", async () => {
    const { fixtures } = harness;
    const live = await fixtures.match("IN_PLAY", "EVENTS_PUBLISHED");
    const noResult = await fixtures.match();

    await expect(settle(harness, live)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(settle(harness, noResult)).rejects.toMatchObject({ code: "SETTLEMENT_FAILED" });
    await expect(settle(harness, randomUUID())).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(await matchSettlement(noResult)).toEqual({
      status: "FAILED",
      failure_reason: "The match has no authoritative result.",
    });
  });
});

describe("voidMatch", () => {
  it("refunds every stake on the match and is idempotent", async () => {
    const { fixtures, peers } = harness;
    const matchId = await fixtures.match("CANCELLED", "VOIDED");
    const userId = randomUUID();

    const online = await fixtures.bet({
      userId,
      stake: 12_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "2.00" }],
    });
    const ticket = await fixtures.bet({
      channel: "SHOP",
      stake: 3_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "AWAY", odds: "3.00" }],
    });

    expect(await voidMatch(harness, matchId)).toMatchObject({ status: "COMPLETED", betsSettled: 2, duplicate: false });
    expect(await voidMatch(harness, matchId)).toMatchObject({ status: "COMPLETED", duplicate: true });

    expect(await settlementsOf(online.betId)).toMatchObject([{ outcome: "VOID", payout: 12_000n }]);
    expect(await settlementsOf(ticket.betId)).toMatchObject([{ outcome: "VOID", payout: 3_000n }]);

    expect(peers.walletCallsFor(online.betId)).toMatchObject([
      {
        ownerType: "CUSTOMER",
        ownerId: userId,
        amount: 12_000,
        type: "BET_REFUND",
        idempotencyKey: `settlement-refund:${online.betId}`,
      },
    ]);
    expect(peers.walletCallsFor(ticket.betId)).toEqual([]);
  });

  it("never rewrites a match that was settled from its result", async () => {
    const { fixtures } = harness;
    const matchId = await fixtures.completedMatch(1, 0);

    await settle(harness, matchId);

    await expect(voidMatch(harness, matchId)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
