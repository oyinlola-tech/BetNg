import { Command } from "@zudojs/cqrs";
import { SETTLEMENT_COMMAND } from "../../../../constants/index.js";

export class RetryEffectsCommand extends Command<"settlement.retryEffects"> {
  public readonly requestId: string;

  public constructor(requestId: string) {
    super(SETTLEMENT_COMMAND.RETRY_EFFECTS);
    this.requestId = requestId;
  }
}
