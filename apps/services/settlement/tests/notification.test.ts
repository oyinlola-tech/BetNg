import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSettlementNotifier, notificationFor } from "../src/clients/index.js";
import type { SettlementRepository } from "../src/interfaces/index.js";
import type { SettlementRecord } from "../src/models/index.js";
import { EffectsApplier } from "../src/services/index.js";
import type { MatchSettlementResult } from "../src/services/index.js";
import {
  RetryEffectsCommand,
  SettleMatchCommand,
  VoidMatchCommand,
} from "../src/services/settlement/commands/index.js";
import { formatNaira } from "../src/utils/index.js";
import { createHarness, SYSTEM } from "./support.js";
import type { Harness } from "./support.js";

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness();
});

afterAll(async () => {
  await harness.close();
});

beforeEach(() => {
  harness.peers.walletFailure = undefined;
  harness.peers.notifyFailure = undefined;
});

async function settle(matchId: string): Promise<MatchSettlementResult> {
  return harness.app.commandBus.execute<SettleMatchCommand, MatchSettlementResult>(
    new SettleMatchCommand({ matchId, actor: SYSTEM }),
  );
}

async function stampedAt(betId: string): Promise<Date | null | undefined> {
  const rows = await harness.fixtures.admin.$queryRaw<{ effects_applied_at: Date | null }[]>`
    SELECT effects_applied_at FROM settlement.settlements WHERE bet_id = ${betId}::uuid`;

  return rows[0]?.effects_applied_at;
}

function record(overrides: Partial<SettlementRecord> = {}): SettlementRecord {
  const matchId = randomUUID();

  return {
    id: randomUUID(),
    betId: randomUUID(),
    revision: 1,
    outcome: "WON",
    stake: 50_000n,
    payout: 128_000n,
    channel: "ONLINE",
    userId: randomUUID(),
    shopId: null,
    cashierId: null,
    periodId: "P-TEST",
    effectsAppliedAt: null,
    settledAt: new Date(),
    legs: [{ selectionId: randomUUID(), matchId, outcome: "WON", result: "2-1" }],
    ...overrides,
  };
}

describe("formatNaira", () => {
  it("formats kobo with integer arithmetic", () => {
    expect(formatNaira(128_000n)).toBe("₦1,280.00");
    expect(formatNaira(5n)).toBe("₦0.05");
    expect(formatNaira(99_999n)).toBe("₦999.99");
    expect(formatNaira(100_000_000_000n)).toBe("₦1,000,000,000.00");
    expect(formatNaira(9_007_199_254_740_993n)).toBe("₦90,071,992,547,409.93");
  });
});

describe("notificationFor", () => {
  it("words a win, a loss and a refund in naira", () => {
    const won = record();
    const lost = record({ outcome: "LOST", payout: 0n });
    const refunded = record({ outcome: "VOID", payout: 50_000n });

    expect(notificationFor(won)).toEqual({
      customerId: won.userId,
      kind: "BET_SETTLED",
      title: "You won ₦1,280.00",
      body: "Your ₦500.00 bet won. ₦1,280.00 has been added to your wallet.",
      data: { betId: won.betId, matchId: won.legs[0]?.matchId, outcome: "WON", payout: 128_000 },
      dedupeKey: `settlement:${won.betId}`,
    });
    expect(notificationFor(lost)).toMatchObject({
      title: "Your bet lost",
      body: "Your ₦500.00 bet did not win this time.",
      data: { outcome: "LOST", payout: 0 },
    });
    expect(notificationFor(refunded)).toMatchObject({
      title: "Bet refunded: ₦500.00",
      body: "Your ₦500.00 bet was voided. ₦500.00 has been returned to your wallet.",
      data: { outcome: "VOID", payout: 50_000 },
    });
  });

  it("has nothing to say about a shop ticket or a bet without a customer", () => {
    expect(notificationFor(record({ channel: "SHOP", userId: null, shopId: randomUUID() }))).toBeUndefined();
    expect(notificationFor(record({ channel: "SHOP" }))).toBeUndefined();
    expect(notificationFor(record({ userId: null, outcome: "LOST", payout: 0n }))).toBeUndefined();
  });
});

describe("settlement notifications", () => {
  it("tells each online customer once, after the effects are stamped", async () => {
    const { fixtures, peers } = harness;
    const matchId = await fixtures.completedMatch(2, 1);
    const winner = randomUUID();
    const loser = randomUUID();

    const won = await fixtures.bet({
      userId: winner,
      stake: 50_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "2.56" }],
    });
    const lost = await fixtures.bet({
      userId: loser,
      stake: 4_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "AWAY", odds: "4.20" }],
    });

    await settle(matchId);

    await vi.waitFor(() => {
      expect(peers.notifyCallsFor(won.betId)).toHaveLength(1);
      expect(peers.notifyCallsFor(lost.betId)).toHaveLength(1);
    });

    expect(peers.notifyCallsFor(won.betId)).toEqual([
      {
        customerId: winner,
        kind: "BET_SETTLED",
        title: "You won ₦1,280.00",
        body: "Your ₦500.00 bet won. ₦1,280.00 has been added to your wallet.",
        data: { betId: won.betId, matchId, outcome: "WON", payout: 128_000 },
        dedupeKey: `settlement:${won.betId}`,
      },
    ]);
    expect(peers.notifyCallsFor(lost.betId)).toEqual([
      {
        customerId: loser,
        kind: "BET_SETTLED",
        title: "Your bet lost",
        body: "Your ₦40.00 bet did not win this time.",
        data: { betId: lost.betId, matchId, outcome: "LOST", payout: 0 },
        dedupeKey: `settlement:${lost.betId}`,
      },
    ]);
    expect(await stampedAt(won.betId)).toBeInstanceOf(Date);
  });

  it("tells the customer about a refund when the match is voided", async () => {
    const { fixtures, peers } = harness;
    const matchId = await fixtures.match("CANCELLED", "VOIDED");
    const userId = randomUUID();

    const bet = await fixtures.bet({
      userId,
      stake: 1_200_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "2.00" }],
    });

    await harness.app.commandBus.execute<VoidMatchCommand, MatchSettlementResult>(
      new VoidMatchCommand({ matchId, reason: "Abandoned in test", actor: SYSTEM }),
    );

    await vi.waitFor(() => {
      expect(peers.notifyCallsFor(bet.betId)).toHaveLength(1);
    });

    expect(peers.notifyCallsFor(bet.betId)[0]).toEqual({
      customerId: userId,
      kind: "BET_SETTLED",
      title: "Bet refunded: ₦12,000.00",
      body: "Your ₦12,000.00 bet was voided. ₦12,000.00 has been returned to your wallet.",
      data: { betId: bet.betId, matchId, outcome: "VOID", payout: 1_200_000 },
      dedupeKey: `settlement:${bet.betId}`,
    });
  });

  it("says nothing for a shop ticket or an online bet without a customer", async () => {
    const { fixtures, peers } = harness;
    const matchId = await fixtures.completedMatch(2, 1);

    const online = await fixtures.bet({
      stake: 1_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "1.50" }],
    });
    const ticket = await fixtures.bet({
      channel: "SHOP",
      stake: 8_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "1.50" }],
    });
    const orphan = await fixtures.bet({
      stake: 2_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "AWAY", odds: "3.00" }],
    });

    await fixtures.admin.$executeRaw`UPDATE betting.bets SET user_id = NULL WHERE id = ${orphan.betId}::uuid`;

    expect(await settle(matchId)).toMatchObject({ status: "COMPLETED", betsSettled: 3 });

    await vi.waitFor(() => {
      expect(peers.notifyCallsFor(online.betId)).toHaveLength(1);
    });

    expect(await stampedAt(ticket.betId)).toBeInstanceOf(Date);
    expect(peers.notifyCallsFor(ticket.betId)).toEqual([]);
    expect(peers.notifyCallsFor(orphan.betId)).toEqual([]);
  });

  it("completes the settlement when identity cannot be reached", async () => {
    const { fixtures, peers } = harness;
    const matchId = await fixtures.completedMatch(1, 0);

    const bet = await fixtures.bet({
      stake: 2_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "2.00" }],
    });

    peers.notifyFailure = new Error("identity is down");

    expect(await settle(matchId)).toEqual({
      matchId,
      status: "COMPLETED",
      betsTotal: 1,
      betsSettled: 1,
      duplicate: false,
    });

    await vi.waitFor(() => {
      expect(peers.notifyCallsFor(bet.betId)).toHaveLength(1);
    });

    expect(await stampedAt(bet.betId)).toBeInstanceOf(Date);
    expect(peers.walletCallsFor(bet.betId)).toHaveLength(1);
  });

  it("does not hold the settlement up while identity is slow", async () => {
    const { fixtures, peers } = harness;
    const matchId = await fixtures.completedMatch(1, 0);
    const notify = peers.identity.notify;

    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    (peers.identity as { notify: typeof notify }).notify = async (notification, requestId) => {
      await gate;

      return notify(notification, requestId);
    };

    try {
      const bet = await fixtures.bet({
        stake: 2_000n,
        legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "2.00" }],
      });

      expect(await settle(matchId)).toMatchObject({ status: "COMPLETED", betsSettled: 1 });
      expect(peers.notifyCallsFor(bet.betId)).toEqual([]);

      release();

      await vi.waitFor(() => {
        expect(peers.notifyCallsFor(bet.betId)).toHaveLength(1);
      });
    } finally {
      release();
      (peers.identity as { notify: typeof notify }).notify = notify;
    }
  });

  it("notifies once across a failed attempt, its retry and a repeated settle call", async () => {
    const { fixtures, peers } = harness;
    const matchId = await fixtures.completedMatch(2, 0);

    const bet = await fixtures.bet({
      stake: 5_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "1.80" }],
    });

    peers.walletFailure = new Error("wallet is down");

    await expect(settle(matchId)).rejects.toMatchObject({ code: "SETTLEMENT_FAILED" });

    expect(await stampedAt(bet.betId)).toBeNull();
    expect(peers.notifyCallsFor(bet.betId)).toEqual([]);

    peers.walletFailure = undefined;

    await harness.app.commandBus.execute(new RetryEffectsCommand("test-retry"));

    await vi.waitFor(() => {
      expect(peers.notifyCallsFor(bet.betId)).toHaveLength(1);
    });

    expect(await settle(matchId)).toMatchObject({ status: "COMPLETED", duplicate: true });

    await harness.app.commandBus.execute(new RetryEffectsCommand("test-retry-again"));

    expect(peers.notifyCallsFor(bet.betId)).toHaveLength(1);
  });

  it("re-applying a stale settlement repeats the dedupe key, so identity keeps one notification", async () => {
    const { peers, app } = harness;
    const stale = record();
    const notifier = createSettlementNotifier(peers.identity, app.logger);

    const effects = new EffectsApplier({
      settlements: { stampEffects: async () => true } as unknown as SettlementRepository,
      betting: peers.betting,
      wallet: peers.wallet,
      notifier,
      logger: app.logger,
    });

    await effects.apply(stale, "first");
    await effects.apply(stale, "second");
    await notifier.idle();

    const calls = peers.notifyCallsFor(stale.betId);

    expect(calls.map((call) => call.dedupeKey)).toEqual([
      `settlement:${stale.betId}`,
      `settlement:${stale.betId}`,
    ]);
    expect([...peers.notified.keys()].filter((key) => key.endsWith(`settlement:${stale.betId}`))).toHaveLength(1);
  });
});
