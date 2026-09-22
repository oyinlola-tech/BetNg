import { CommandHandler } from "@zudojs/cqrs";
import { AUDIT_ACTION, AUDIT_ENTITY, SETTLEMENT_COMMAND } from "../../../../constants/index.js";
import { SettlementConflictError, SettlementNotFoundError } from "../../../../errors/index.js";
import type { AuditRecorder, SettlementRepository } from "../../../../interfaces/index.js";
import type { AdminSettlementRecord } from "../../../../models/index.js";
import type { MatchSettler } from "../../match.settler.js";
import type { RetrySettlementCommand } from "./retrySettlement.command.js";

function auditView(record: AdminSettlementRecord): Readonly<Record<string, unknown>> {
  return {
    status: record.status,
    settlementId: record.settlementId,
    payout: record.payout.toString(),
    failedMatchIds: record.failedMatchIds,
  };
}

/** The outcome is recalculated from the recorded result, never supplied by the caller. */
export class RetrySettlementHandler extends CommandHandler<RetrySettlementCommand, AdminSettlementRecord> {
  public readonly commandType = SETTLEMENT_COMMAND.RETRY_SETTLEMENT;

  private readonly settlements: SettlementRepository;
  private readonly settler: MatchSettler;
  private readonly audit: AuditRecorder;

  public constructor(settlements: SettlementRepository, settler: MatchSettler, audit: AuditRecorder) {
    super();
    this.settlements = settlements;
    this.settler = settler;
    this.audit = audit;
  }

  public async execute(command: RetrySettlementCommand): Promise<AdminSettlementRecord> {
    const listed = await this.settlements.findAdminByBet(command.betId);

    if (listed === undefined) {
      throw new SettlementNotFoundError(command.betId);
    }

    if (listed.status !== "FAILED") {
      throw new SettlementConflictError("Only a failed settlement can be retried.", {
        betId: command.betId,
      });
    }

    // An operator-triggered money movement: nothing runs unless the request is on record.
    await this.audit.recordRequired({
      ...command.actor,
      action: AUDIT_ACTION.SETTLEMENT_RETRY_REQUESTED,
      entityType: AUDIT_ENTITY.BET_SETTLEMENT,
      entityId: command.betId,
      before: auditView(listed),
      reason: command.reason,
      severity: "WARNING",
    });

    try {
      for (const matchId of listed.failedMatchIds) {
        const matchSettlement = await this.settlements.findMatchSettlement(matchId);

        if (matchSettlement?.status === "FAILED") {
          await this.settler.settle({
            matchId,
            kind: matchSettlement.kind,
            actor: command.actor,
            reason: command.reason,
          });
        }
      }
    } finally {
      const after = (await this.settlements.findAdminByBet(command.betId)) ?? listed;

      await this.audit.recordBestEffort({
        ...command.actor,
        action: AUDIT_ACTION.SETTLEMENT_RETRY_FINISHED,
        entityType: AUDIT_ENTITY.BET_SETTLEMENT,
        entityId: command.betId,
        before: auditView(listed),
        after: auditView(after),
        reason: command.reason,
        severity: after.status === "FAILED" ? "WARNING" : "NOTICE",
      });
    }

    return (await this.settlements.findAdminByBet(command.betId)) ?? listed;
  }
}
