import { Command } from "@zudojs/cqrs";
import { BETTING_COMMAND } from "../../../../constants/index.js";
import type { SettlementInput } from "../../../../interfaces/index.js";

export class ApplySettlementCommand extends Command<"betting.applySettlement"> {
  public readonly settlement: SettlementInput;

  public readonly requestId: string | undefined;

  public constructor(settlement: SettlementInput, requestId?: string) {
    super(BETTING_COMMAND.APPLY_SETTLEMENT);
    this.settlement = settlement;
    this.requestId = requestId;
  }
}
