import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class CancelAccountDeletionCommand extends Command<"identity.cancelAccountDeletion"> {
  public readonly caller: CustomerCaller;

  public constructor(caller: CustomerCaller) {
    super(IDENTITY_COMMAND.CANCEL_ACCOUNT_DELETION);
    this.caller = caller;
  }
}
