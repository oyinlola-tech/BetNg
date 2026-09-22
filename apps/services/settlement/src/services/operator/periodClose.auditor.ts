import type { Logger } from "@betng/service-kit";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../../constants/index.js";
import type { AuditActor, AuditEntry, AuditRecorder } from "../../interfaces/index.js";
import type { ClosedPeriodResult, OperatorPeriodRecord } from "../../models/index.js";

export class PeriodCloseAuditor {
  private readonly audit: AuditRecorder;
  private readonly logger: Logger;

  public constructor(audit: AuditRecorder, logger: Logger) {
    this.audit = audit;
    this.logger = logger;
  }

  /** Best effort: the scheduled roll-over must not stop because identity is down. */
  public async record(result: ClosedPeriodResult, actor: AuditActor, reason: string): Promise<void> {
    this.logClosed(result, actor);
    await this.audit.recordBestEffort(entryFor(result, actor, reason));
  }

  /** Inside the close transaction: an operator's close stands only if its audit entry does. */
  public async require(
    result: ClosedPeriodResult,
    before: OperatorPeriodRecord,
    actor: AuditActor,
    reason: string,
  ): Promise<void> {
    await this.audit.recordRequired(entryFor(result, actor, reason, before));
    this.logClosed(result, actor);
  }

  private logClosed(result: ClosedPeriodResult, actor: AuditActor): void {
    this.logger.info("Reporting period closed", {
      requestId: actor.requestId,
      periodId: result.closed.period.id,
      nextPeriodId: result.opened.id,
      operatorResult: result.closed.operatorResult.toString(),
      shops: result.commissions.length,
    });
  }
}

function entryFor(
  result: ClosedPeriodResult,
  actor: AuditActor,
  reason: string,
  before?: OperatorPeriodRecord,
): AuditEntry {
  const { closed, opened, commissions } = result;

  return {
    ...actor,
    action: AUDIT_ACTION.PERIOD_CLOSED,
    entityType: AUDIT_ENTITY.OPERATOR_PERIOD,
    entityId: closed.period.id,
    ...(before === undefined
      ? {}
      : {
          before: {
            status: before.status,
            kind: before.kind,
            startsAt: before.startsAt.toISOString(),
            endsAt: before.endsAt?.toISOString() ?? null,
          },
        }),
    // Kobo as strings: an audit payload is JSON and these are bigint.
    after: {
      status: closed.period.status,
      endsAt: closed.period.endsAt?.toISOString() ?? null,
      grossStakes: closed.grossStakes.toString(),
      grossPayouts: closed.grossPayouts.toString(),
      operatorResult: closed.operatorResult.toString(),
      settledBets: closed.settledBets,
      voidBets: closed.voidBets,
      commissionRows: commissions.length,
      nextPeriodId: opened.id,
    },
    reason,
    severity: "NOTICE",
  };
}
