import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ClosePeriodCommand } from "../src/services/operator/commands/index.js";
import { GetOperatorOverviewQuery } from "../src/services/operator/queries/index.js";
import type { OperatorOverview } from "../src/services/operator/queries/index.js";
import { UpdateCommissionConfigCommand } from "../src/services/commission/commands/index.js";
import { GetCommissionConfigQuery } from "../src/services/commission/queries/index.js";
import type { CurrentCommissionConfig } from "../src/services/commission/queries/index.js";
import { SettleMatchCommand, VoidMatchCommand } from "../src/services/settlement/commands/index.js";
import type { ClosedPeriodResult } from "../src/models/index.js";
import { percentToBasisPoints } from "../src/utils/index.js";
import { createHarness, SYSTEM } from "./support.js";
import type { Harness } from "./support.js";

const ADMIN = Object.freeze({ actorId: randomUUID(), actorRole: "SUPER_ADMIN", requestId: "operator-test" });

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness();
});

afterAll(async () => {
  await harness.close();
});

async function settle(matchId: string): Promise<void> {
  await harness.app.commandBus.execute(new SettleMatchCommand({ matchId, actor: SYSTEM }));
}

async function closePeriod(reason: string): Promise<ClosedPeriodResult> {
  return harness.app.commandBus.execute<ClosePeriodCommand, ClosedPeriodResult>(
    new ClosePeriodCommand({ reason, actor: ADMIN }),
  );
}

async function overview(): Promise<OperatorOverview> {
  return harness.app.queryBus.execute<GetOperatorOverviewQuery, OperatorOverview>(
    new GetOperatorOverviewQuery(50),
  );
}

async function ledgerRow(periodId: string): Promise<Record<string, unknown> | undefined> {
  const rows = await harness.fixtures.admin.$queryRaw<Record<string, unknown>[]>`
    SELECT period_id, gross_stakes, gross_payouts, operator_result, operator_result_rate::text AS rate,
           settled_bets, void_bets, refunded_stakes, status, created_at
    FROM settlement.operator_ledger WHERE period_id = ${periodId}`;

  return rows[0];
}

async function commissionRow(periodId: string, shopId: string): Promise<Record<string, unknown> | undefined> {
  const rows = await harness.fixtures.admin.$queryRaw<Record<string, unknown>[]>`
    SELECT gross_stakes, gross_payouts, gross_operator_result, shop_share_percent::text AS shop_percent,
           shop_share_amount, platform_share_percent::text AS platform_percent, platform_share_amount, created_at
    FROM settlement.commission_ledger WHERE period_id = ${periodId} AND shop_id = ${shopId}::uuid`;

  return rows[0];
}

describe("operator ledger and owner protection", () => {
  it("records a positive result, then a negative one exactly, and no wallet ever absorbs it", async () => {
    const { fixtures, peers } = harness;

    await closePeriod("Start period A clean");

    const walletCallsBefore = peers.walletCalls.length;
    const customers = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const betIds: string[] = [];

    // Period A: customers lose overall. Stakes 700,000; payouts 400,000; a void bet is refunded, not counted.
    const matchA = await fixtures.completedMatch(1, 0);
    const voidedA = await fixtures.match("CANCELLED", "VOIDED");

    for (const bet of [
      { userId: customers[0], stake: 500_000n, code: "AWAY", odds: "3.00", matchId: matchA },
      { userId: customers[1], stake: 200_000n, code: "HOME", odds: "2.00", matchId: matchA },
    ]) {
      const inserted = await fixtures.bet({
        userId: bet.userId as string,
        stake: bet.stake,
        legs: [{ matchId: bet.matchId, marketType: "MATCH_RESULT", selectionCode: bet.code, odds: bet.odds }],
      });

      betIds.push(inserted.betId);
    }

    const refunded = await fixtures.bet({
      userId: customers[2] as string,
      stake: 50_000n,
      legs: [
        { matchId: voidedA, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "2.00" },
      ],
    });

    betIds.push(refunded.betId);

    await settle(matchA);
    await harness.app.commandBus.execute(
      new VoidMatchCommand({ matchId: voidedA, reason: "Voided in test", actor: SYSTEM }),
    );

    const live = (await overview()).current;

    expect(live).toMatchObject({
      grossStakes: 700_000n,
      grossPayouts: 400_000n,
      operatorResult: 300_000n,
      settledBets: 2,
      voidBets: 1,
      refundedStakes: 50_000n,
    });
    expect(Number(live.operatorResultRate)).toBeCloseTo(300_000 / 700_000, 6);

    const closedA = await closePeriod("Close period A");

    expect(closedA.closed.period.status).toBe("CLOSED");
    expect(closedA.closed.operatorResult).toBe(300_000n);
    expect(closedA.opened.status).toBe("OPEN");
    expect(closedA.opened.id).toMatch(/^SESSION-\d{8}-\d{4}$/);
    expect(closedA.opened.id > closedA.closed.period.id).toBe(true);

    const rowA = await ledgerRow(closedA.closed.period.id);

    expect(rowA).toMatchObject({
      gross_stakes: 700_000n,
      gross_payouts: 400_000n,
      operator_result: 300_000n,
      settled_bets: 2,
      void_bets: 1,
      refunded_stakes: 50_000n,
      status: "CLOSED",
    });

    // Period B: payouts exceed stakes. Stakes 1,000,000; payouts 1,100,000.
    const matchB = await fixtures.completedMatch(0, 0);

    const winner = await fixtures.bet({
      userId: customers[3] as string,
      stake: 1_000_000n,
      legs: [{ matchId: matchB, marketType: "MATCH_RESULT", selectionCode: "DRAW", odds: "1.10" }],
    });

    betIds.push(winner.betId);

    await settle(matchB);

    const closedB = await closePeriod("Close period B");

    expect(closedB.closed).toMatchObject({
      grossStakes: 1_000_000n,
      grossPayouts: 1_100_000n,
      operatorResult: -100_000n,
      operatorResultRate: "-0.100000",
    });
    expect(await ledgerRow(closedB.closed.period.id)).toMatchObject({
      gross_stakes: 1_000_000n,
      gross_payouts: 1_100_000n,
      operator_result: -100_000n,
      rate: "-0.100000",
    });

    const summaries = (await overview()).closed;
    const reportedB = summaries.find((summary) => summary.period.id === closedB.closed.period.id);

    expect(reportedB?.operatorResult).toBe(-100_000n);
    expect(Number(reportedB?.operatorResultRate)).toBe(-0.1);

    // Nothing rewritten: period A's row is byte-for-byte what it was, and every bet is still there.
    expect(await ledgerRow(closedA.closed.period.id)).toEqual(rowA);

    const bets = await fixtures.admin.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM betting.bets WHERE id = ANY(${betIds}::uuid[])`;
    const settlements = await fixtures.admin.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM settlement.settlements WHERE bet_id = ANY(${betIds}::uuid[])`;

    expect(bets[0]?.n).toBe(betIds.length);
    expect(settlements[0]?.n).toBe(betIds.length);

    // The only wallet traffic is customers being paid or refunded. Nobody is debited, and the admin who
    // closed the periods — the operator's owner — is never a wallet owner.
    const calls = peers.walletCalls.slice(walletCallsBefore);

    expect(calls.map((call) => [call.ownerType, call.ownerId, call.type, call.amount])).toEqual(
      expect.arrayContaining([
        ["CUSTOMER", customers[1], "BET_PAYOUT", 400_000],
        ["CUSTOMER", customers[2], "BET_REFUND", 50_000],
        ["CUSTOMER", customers[3], "BET_PAYOUT", 1_100_000],
      ]),
    );
    expect(calls).toHaveLength(3);
    expect(calls.every((call) => call.ownerType === "CUSTOMER" && call.amount > 0)).toBe(true);
    expect(calls.some((call) => call.ownerId === ADMIN.actorId || call.ownerId === "system")).toBe(false);
    expect(Object.keys(peers.wallet)).toEqual(["credit"]);

    expect(
      peers.audits.filter((entry) => entry.action === "period_closed").map((entry) => entry.entityId),
    ).toEqual(expect.arrayContaining([closedA.closed.period.id, closedB.closed.period.id]));
  });
});

describe("commission", () => {
  it("shares a positive shop result, carries a negative one whole, and reads the percent from config", async () => {
    const { fixtures } = harness;
    const profitable = await fixtures.shop("Profitable Shop");
    const losing = await fixtures.shop("Losing Shop");

    await closePeriod("Start commission period clean");

    const current = await harness.app.queryBus.execute<GetCommissionConfigQuery, CurrentCommissionConfig>(
      new GetCommissionConfigQuery(),
    );
    const defaultBasisPoints = percentToBasisPoints(current.platformDefault.shopSharePercent);

    const match = await fixtures.completedMatch(2, 0);

    // Profitable shop: stakes 100,999; payouts 0 → result 100,999. Losing shop: stakes 10,000; payouts 35,000.
    await fixtures.bet({
      channel: "SHOP",
      shopId: profitable,
      stake: 100_999n,
      legs: [{ matchId: match, marketType: "MATCH_RESULT", selectionCode: "AWAY", odds: "5.00" }],
    });
    await fixtures.bet({
      channel: "SHOP",
      shopId: losing,
      stake: 10_000n,
      legs: [{ matchId: match, marketType: "GOAL_SPREAD", selectionCode: "HOME_MINUS_1_5", odds: "3.50" }],
    });

    await settle(match);

    const first = await closePeriod("Close first commission period");
    const firstId = first.closed.period.id;

    const expectedShare = (100_999n * BigInt(defaultBasisPoints)) / 10_000n;
    const profitableRow = await commissionRow(firstId, profitable);

    expect(profitableRow).toMatchObject({
      gross_stakes: 100_999n,
      gross_payouts: 0n,
      gross_operator_result: 100_999n,
      shop_percent: current.platformDefault.shopSharePercent,
      shop_share_amount: expectedShare,
      platform_share_amount: 100_999n - expectedShare,
    });

    expect(await commissionRow(firstId, losing)).toMatchObject({
      gross_stakes: 10_000n,
      gross_payouts: 35_000n,
      gross_operator_result: -25_000n,
      shop_share_amount: 0n,
      platform_share_amount: -25_000n,
    });

    expect(first.commissions.map((row) => row.shopId).sort()).toEqual([profitable, losing].sort());

    // A new configuration version applies to the next close only.
    await harness.app.commandBus.execute(
      new UpdateCommissionConfigCommand({
        shopId: profitable,
        shopSharePercent: 12.5,
        reason: "Negotiated rate",
        actor: ADMIN,
      }),
    );

    const nextMatch = await fixtures.completedMatch(0, 1);

    await fixtures.bet({
      channel: "SHOP",
      shopId: profitable,
      stake: 999n,
      legs: [{ matchId: nextMatch, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "2.00" }],
    });

    await settle(nextMatch);

    const second = await closePeriod("Close second commission period");

    expect(await commissionRow(second.closed.period.id, profitable)).toMatchObject({
      gross_operator_result: 999n,
      shop_percent: "12.50",
      shop_share_amount: 124n,
      platform_percent: "87.50",
      platform_share_amount: 875n,
    });
    expect(await commissionRow(second.closed.period.id, losing)).toBeUndefined();
    expect(await commissionRow(firstId, profitable)).toEqual(profitableRow);
  });

  it("versions the configuration, audits before/after, and refuses the change when the audit fails", async () => {
    const { fixtures, peers } = harness;
    const shopId = await fixtures.shop("Audited Shop");

    const update = async (percent: number): Promise<unknown> =>
      harness.app.commandBus.execute(
        new UpdateCommissionConfigCommand({
          shopId,
          shopSharePercent: percent,
          reason: "Rate review",
          actor: ADMIN,
        }),
      );

    await update(15);
    await update(17.25);

    const versions = await fixtures.admin.$queryRaw<{ percent: string; created_by: string }[]>`
      SELECT shop_share_percent::text AS percent, created_by
      FROM settlement.commission_config WHERE shop_id = ${shopId}::uuid ORDER BY effective_from, id`;

    expect(versions).toEqual([
      { percent: "15.00", created_by: ADMIN.actorId },
      { percent: "17.25", created_by: ADMIN.actorId },
    ]);

    const audit = peers.audits.filter(
      (entry) => entry.action === "commission_configuration_changed" && entry.entityId === shopId,
    );

    expect(audit).toHaveLength(2);
    expect(audit[0]?.before).toBeUndefined();
    expect(audit[1]).toMatchObject({
      actorId: ADMIN.actorId,
      before: { shopSharePercent: "15.00" },
      after: { shopSharePercent: "17.25" },
      reason: "Rate review",
    });

    peers.auditFailure = new Error("identity is down");

    try {
      await expect(update(40)).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE", statusCode: 503 });
    } finally {
      peers.auditFailure = undefined;
    }

    const after = await fixtures.admin.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM settlement.commission_config WHERE shop_id = ${shopId}::uuid`;

    expect(after[0]?.n).toBe(2);

    await expect(
      harness.app.commandBus.execute(
        new UpdateCommissionConfigCommand({
          shopId: randomUUID(),
          shopSharePercent: 10,
          reason: "Unknown shop",
          actor: ADMIN,
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("append-only tables", () => {
  it("rejects UPDATE and DELETE on settlements and every ledger, even for the superuser", async () => {
    const { fixtures } = harness;
    const shopId = await fixtures.shop("Trigger Shop");
    const matchId = await fixtures.completedMatch(1, 0);

    const bet = await fixtures.bet({
      channel: "SHOP",
      shopId,
      stake: 1_000n,
      legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "2.00" }],
    });

    await settle(matchId);

    const closed = await closePeriod("Close for trigger test");
    const periodId = closed.closed.period.id;
    const admin = fixtures.admin;

    const attempts: readonly (() => Promise<unknown>)[] = [
      async () => admin.$executeRaw`UPDATE settlement.settlements SET payout = 0 WHERE bet_id = ${bet.betId}::uuid`,
      async () => admin.$executeRaw`UPDATE settlement.settlements SET outcome = 'LOST', payout = 0 WHERE bet_id = ${bet.betId}::uuid`,
      async () => admin.$executeRaw`UPDATE settlement.settlements SET effects_applied_at = now() WHERE bet_id = ${bet.betId}::uuid`,
      async () => admin.$executeRaw`UPDATE settlement.settlements SET effects_applied_at = NULL WHERE bet_id = ${bet.betId}::uuid`,
      async () => admin.$executeRaw`DELETE FROM settlement.settlements WHERE bet_id = ${bet.betId}::uuid`,
      async () => admin.$executeRaw`UPDATE settlement.settled_selections SET outcome = 'LOST' WHERE match_id = ${matchId}::uuid`,
      async () => admin.$executeRaw`DELETE FROM settlement.settled_selections WHERE match_id = ${matchId}::uuid`,
      async () => admin.$executeRaw`UPDATE settlement.operator_ledger_entries SET payout = 0 WHERE bet_id = ${bet.betId}::uuid`,
      async () => admin.$executeRaw`DELETE FROM settlement.operator_ledger_entries WHERE bet_id = ${bet.betId}::uuid`,
      async () => admin.$executeRaw`UPDATE settlement.operator_ledger SET operator_result = 0, gross_payouts = gross_stakes WHERE period_id = ${periodId}`,
      async () => admin.$executeRaw`DELETE FROM settlement.operator_ledger WHERE period_id = ${periodId}`,
      async () => admin.$executeRaw`UPDATE settlement.commission_ledger SET shop_share_amount = 1, platform_share_amount = platform_share_amount - 1 WHERE period_id = ${periodId}`,
      async () => admin.$executeRaw`DELETE FROM settlement.commission_ledger WHERE period_id = ${periodId}`,
      async () => admin.$executeRaw`UPDATE settlement.commission_config SET shop_share_percent = 99 WHERE shop_id IS NULL`,
      async () => admin.$executeRaw`UPDATE settlement.operator_periods SET status = 'OPEN', ends_at = NULL WHERE id = ${periodId}`,
      async () => admin.$executeRaw`DELETE FROM settlement.operator_periods WHERE id = ${periodId}`,
      async () => admin.$executeRaw`TRUNCATE settlement.operator_ledger_entries`,
    ];

    for (const attempt of attempts) {
      await expect(attempt()).rejects.toThrow(/append-only|never deleted|set once/);
    }

    const rows = await admin.$queryRaw<{ payout: bigint; outcome: string }[]>`
      SELECT payout, outcome FROM settlement.settlements WHERE bet_id = ${bet.betId}::uuid`;

    expect(rows).toEqual([{ payout: 2_000n, outcome: "WON" }]);
  });

  it("refuses rows that break the money invariants", async () => {
    const admin = harness.fixtures.admin;
    const open = (await overview()).current.period.id;

    await expect(
      admin.$executeRaw`
        INSERT INTO settlement.settlements (bet_id, outcome, stake, payout, channel, period_id)
        VALUES (${randomUUID()}::uuid, 'WON', -1, 0, 'ONLINE', ${open})`,
    ).rejects.toThrow(/settlements_stake_non_negative/);

    await expect(
      admin.$executeRaw`
        INSERT INTO settlement.settlements (bet_id, outcome, stake, payout, channel, period_id)
        VALUES (${randomUUID()}::uuid, 'LOST', 100, 50, 'ONLINE', ${open})`,
    ).rejects.toThrow(/settlements_loss_pays_nothing/);

    await expect(
      admin.$executeRaw`
        INSERT INTO settlement.commission_config (shop_id, shop_share_percent, created_by, reason)
        VALUES (NULL, 100.5, 'test', 'out of range')`,
    ).rejects.toThrow(/commission_config_percent_range/);
  });
});
