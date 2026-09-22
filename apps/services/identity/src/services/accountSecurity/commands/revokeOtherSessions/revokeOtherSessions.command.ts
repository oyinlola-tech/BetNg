import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class RevokeOtherSessionsCommand extends Command<"identity.revokeOtherSessions"> {
  public readonly caller: CustomerCaller;

  public constructor(caller: CustomerCaller) {
    super(IDENTITY_COMMAND.REVOKE_OTHER_SESSIONS);
    this.caller = caller;
  }
}
