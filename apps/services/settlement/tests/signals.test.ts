import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { betSignalChannels } from "../src/clients/index.js";
import type { MatchSettlementResult } from "../src/services/index.js";
import { SettleMatchCommand } from "../src/services/settlement/commands/index.js";
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
  harness.peers.eventFailure = undefined;
  harness.peers.walletFailure = undefined;
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

function signalsFor(customerId: string): { channel: string; type: string; betId: string }[] {
  return harness.peers.signals
    .filter((signal) => signal.channel.endsWith(customerId))
    .map(({ channel, type, betId }) => ({ channel, type, betId }));
}

describe("BET_SETTLED realtime signal", () => {
  it("tells the customer's user and bets channels once the effects are applied, with only the bet id", async () => {
    const { fixtures, peers } = harness;
    const matchId = await fixtures.completedMatch(2, 1);
    const customer = randomUUID();
    const bet = await fixtures.bet({
      userId: customer,
      stake: 10_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "2.00" }],
    });

    await settle(matchId);

    await vi.waitFor(() => {
      expect(signalsFor(customer)).toHaveLength(2);
    });
    expect(signalsFor(customer)).toEqual([
      { channel: `user:${customer}`, type: "BET_SETTLED", betId: bet.betId },
      { channel: `bets:${customer}`, type: "BET_SETTLED", betId: bet.betId },
    ]);
    expect(await stampedAt(bet.betId)).toBeInstanceOf(Date);
    expect(peers.walletCallsFor(bet.betId)).toHaveLength(1);
  });

  it("never fails or holds up a settlement when the event service is down", async () => {
    const { fixtures, peers } = harness;
    const matchId = await fixtures.completedMatch(0, 1);
    const customer = randomUUID();
    const bet = await fixtures.bet({
      userId: customer,
      stake: 10_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "AWAY", odds: "3.00" }],
    });

    peers.eventFailure = new Error("event service unreachable");
    await settle(matchId);

    expect(await stampedAt(bet.betId)).toBeInstanceOf(Date);
    expect(peers.walletCallsFor(bet.betId)).toHaveLength(1);
    expect(signalsFor(customer)).toHaveLength(0);
  });

  it("is not sent before the effects are stamped", async () => {
    const { fixtures, peers } = harness;
    const matchId = await fixtures.completedMatch(3, 0);
    const customer = randomUUID();
    const bet = await fixtures.bet({
      userId: customer,
      stake: 10_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "1.50" }],
    });

    peers.walletFailure = new Error("wallet down");
    await settle(matchId).catch(() => undefined);

    expect(await stampedAt(bet.betId)).toBeNull();
    expect(signalsFor(customer)).toHaveLength(0);
  });

  it("has no channel for a shop ticket or a bet without a customer", () => {
    const base = {
      id: randomUUID(),
      betId: randomUUID(),
      revision: 1,
      outcome: "WON" as const,
      stake: 1n,
      payout: 2n,
      shopId: null,
      cashierId: null,
      periodId: "P",
      effectsAppliedAt: null,
      settledAt: new Date(),
      legs: [],
    };

    expect(betSignalChannels({ ...base, channel: "SHOP", userId: null, shopId: randomUUID() })).toEqual([]);
    expect(betSignalChannels({ ...base, channel: "ONLINE", userId: null })).toEqual([]);
  });
});
