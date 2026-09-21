import { CommandHandler } from "@zudojs/cqrs";
import { SETTLEMENT_COMMAND } from "../../../../constants/index.js";
import { SettlementConflictError } from "../../../../errors/index.js";
import type { OperatorRepository } from "../../../../interfaces/index.js";
import type { ClosedPeriodResult } from "../../../../models/index.js";
import type { PeriodCloseAuditor } from "../../periodClose.auditor.js";
import type { ClosePeriodCommand } from "./closePeriod.command.js";

export class ClosePeriodHandler extends CommandHandler<ClosePeriodCommand, ClosedPeriodResult> {
  public readonly commandType = SETTLEMENT_COMMAND.CLOSE_PERIOD;

  private readonly operator: OperatorRepository;
  private readonly auditor: PeriodCloseAuditor;

  public constructor(operator: OperatorRepository, auditor: PeriodCloseAuditor) {
    super();
    this.operator = operator;
    this.auditor = auditor;
  }

  public async execute(command: ClosePeriodCommand): Promise<ClosedPeriodResult> {
    const result = await this.operator.closePeriod({ nextKind: command.nextKind, now: new Date() });

    if (result === undefined) {
      throw new SettlementConflictError("No reporting period is open.");
    }

    await this.auditor.record(result, command.actor, command.reason);

    return result;
  }
}
