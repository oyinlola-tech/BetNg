import { Command } from "@zudojs/cqrs";
import { SETTLEMENT_COMMAND } from "../../../../constants/index.js";

export class RollOverPeriodCommand extends Command<"settlement.rollOverPeriod"> {
  public readonly now: Date;
  public readonly requestId: string;

  public constructor(now: Date, requestId: string) {
    super(SETTLEMENT_COMMAND.ROLL_OVER_PERIOD);
    this.now = now;
    this.requestId = requestId;
  }
}
