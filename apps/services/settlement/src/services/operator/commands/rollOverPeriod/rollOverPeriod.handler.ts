import { CommandHandler } from "@zudojs/cqrs";
import { SETTLEMENT_COMMAND, SYSTEM_ACTOR } from "../../../../constants/index.js";
import type { OperatorRepository } from "../../../../interfaces/index.js";
import { utcDateKey } from "../../../../utils/index.js";
import type { PeriodCloseAuditor } from "../../periodClose.auditor.js";
import type { RollOverPeriodCommand } from "./rollOverPeriod.command.js";

/** Closes a DAY period opened on an earlier UTC day and opens today's. Returns whether it rolled over. */
export class RollOverPeriodHandler extends CommandHandler<RollOverPeriodCommand, boolean> {
  public readonly commandType = SETTLEMENT_COMMAND.ROLL_OVER_PERIOD;

  private readonly operator: OperatorRepository;
  private readonly auditor: PeriodCloseAuditor;

  public constructor(operator: OperatorRepository, auditor: PeriodCloseAuditor) {
    super();
    this.operator = operator;
    this.auditor = auditor;
  }

  public async execute(command: RollOverPeriodCommand): Promise<boolean> {
    const open = await this.operator.ensureOpenPeriod(command.now);

    if (open.kind !== "DAY" || utcDateKey(open.startsAt) >= utcDateKey(command.now)) {
      return false;
    }

    const result = await this.operator.closePeriod({
      expectedPeriodId: open.id,
      nextKind: "DAY",
      now: command.now,
    });

    if (result === undefined) {
      return false;
    }

    await this.auditor.record(
      result,
      { ...SYSTEM_ACTOR, requestId: command.requestId },
      "UTC day rolled over",
    );

    return true;
  }
}
