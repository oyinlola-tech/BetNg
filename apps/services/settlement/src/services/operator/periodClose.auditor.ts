import type { Logger } from "@betng/service-kit";
import { AUDIT_ACTION, AUDIT_ENTITY } from "../../constants/index.js";
import type { AuditActor, AuditRecorder } from "../../interfaces/index.js";
import type { ClosedPeriodResult } from "../../models/index.js";

export class PeriodCloseAuditor {
  private readonly audit: AuditRecorder;
  private readonly logger: Logger;

  public constructor(audit: AuditRecorder, logger: Logger) {
    this.audit = audit;
    this.logger = logger;
  }

  public async record(result: ClosedPeriodResult, actor: AuditActor, reason: string): Promise<void> {
    const { closed, opened, commissions } = result;

    this.logger.info("Reporting period closed", {
      requestId: actor.requestId,
      periodId: closed.period.id,
      nextPeriodId: opened.id,
      operatorResult: closed.operatorResult.toString(),
      shops: commissions.length,
    });

    await this.audit.recordBestEffort({
      ...actor,
      action: AUDIT_ACTION.PERIOD_CLOSED,
      entityType: AUDIT_ENTITY.OPERATOR_PERIOD,
      entityId: closed.period.id,
      // Kobo as strings: an audit payload is JSON and these are bigint.
      after: {
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
    });
  }
}
