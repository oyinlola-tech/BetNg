import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditUnavailableError } from "../src/errors/index.js";
import type { AdminSettlementRecord, ClosedPeriodResult } from "../src/models/index.js";
import { ClosePeriodCommand } from "../src/services/operator/commands/index.js";
import { RetrySettlementCommand, SettleMatchCommand } from "../src/services/settlement/commands/index.js";
import { createHarness, SYSTEM } from "./support.js";
import type { Harness } from "./support.js";

const ADMIN = Object.freeze({ actorId: randomUUID(), actorRole: "SUPER_ADMIN", requestId: "admin-audit-test" });

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness();
});

afterAll(async () => {
  await harness.close();
});

beforeEach(() => {
  harness.peers.auditFailure = undefined;
  harness.peers.walletFailure = undefined;
});

async function openPeriodId(): Promise<string> {
  const rows = await harness.fixtures.admin.$queryRaw<{ id: string }[]>`
    SELECT id FROM settlement.operator_periods WHERE status = 'OPEN'`;

  return rows[0]?.id ?? "";
}

async function closePeriod(reason: string): Promise<ClosedPeriodResult> {
  return harness.app.commandBus.execute<ClosePeriodCommand, ClosedPeriodResult>(
    new ClosePeriodCommand({ reason, actor: ADMIN }),
  );
}

async function failedBet(): Promise<string> {
  const { fixtures, peers } = harness;
  const matchId = await fixtures.completedMatch(1, 0);
  const bet = await fixtures.bet({
    userId: randomUUID(),
    stake: 4_000n,
    legs: [{ matchId, marketType: "MATCH_RESULT", selectionCode: "HOME", odds: "1.75" }],
  });

  peers.walletFailure = new Error("wallet is down");
  await harness.app.commandBus.execute(new SettleMatchCommand({ matchId, actor: SYSTEM })).catch(() => undefined);
  peers.walletFailure = undefined;

  return bet.betId;
}

async function retry(betId: string, reason: string): Promise<AdminSettlementRecord> {
  return harness.app.commandBus.execute<RetrySettlementCommand, AdminSettlementRecord>(
    new RetrySettlementCommand({ betId, reason, actor: ADMIN }),
  );
}

describe("operator period close audit", () => {
  it("records the actor, reason, before and after", async () => {
    const before = await openPeriodId();
    const result = await closePeriod("Month end close");
    const entry = harness.peers.audits.find(
      (audit) => audit.action === "period_closed" && audit.entityId === result.closed.period.id,
    );

    expect(result.closed.period.id).toBe(before);
    expect(entry).toMatchObject({
      actorId: ADMIN.actorId,
      actorRole: "SUPER_ADMIN",
      reason: "Month end close",
      before: { status: "OPEN" },
      after: { status: "CLOSED", nextPeriodId: result.opened.id },
    });
  });

  it("is refused, and leaves the period open, when the audit cannot be written", async () => {
    const before = await openPeriodId();

    harness.peers.auditFailure = new Error("identity is down");

    await expect(closePeriod("Close while identity is down")).rejects.toBeInstanceOf(AuditUnavailableError);
    expect(await openPeriodId()).toBe(before);
  });
});

describe("operator settlement retry audit", () => {
  it("writes the request before paying anything, then the outcome with before and after", async () => {
    const betId = await failedBet();
    const creditsBefore = harness.peers.walletCallsFor(betId).length;

    const retried = await retry(betId, "Wallet is back");

    expect(retried.status).toBe("COMPLETED");

    const entries = harness.peers.audits.filter((audit) => audit.entityId === betId);

    expect(entries.map((audit) => audit.action)).toEqual(["settlement_retry_requested", "settlement_retry_finished"]);
    expect(entries[0]).toMatchObject({ actorId: ADMIN.actorId, reason: "Wallet is back", before: { status: "FAILED" } });
    expect(entries[1]).toMatchObject({ before: { status: "FAILED" }, after: { status: "COMPLETED" } });
    expect(harness.peers.walletCallsFor(betId).length).toBeGreaterThan(creditsBefore);
  });

  it("does not retry at all when the request cannot be audited", async () => {
    const betId = await failedBet();
    const credits = harness.peers.walletCallsFor(betId).length;

    harness.peers.auditFailure = new Error("identity is down");

    await expect(retry(betId, "Retry while identity is down")).rejects.toBeInstanceOf(AuditUnavailableError);
    expect(harness.peers.walletCallsFor(betId).length).toBe(credits);
  });
});
