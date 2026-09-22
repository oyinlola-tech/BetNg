import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class CancelSelfExclusionCommand extends Command<"identity.cancelSelfExclusion"> {
  public readonly caller: CustomerCaller;

  public constructor(caller: CustomerCaller) {
    super(IDENTITY_COMMAND.CANCEL_SELF_EXCLUSION);
    this.caller = caller;
  }
}
