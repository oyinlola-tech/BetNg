import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class RevokeSessionCommand extends Command<"identity.revokeSession"> {
  public readonly caller: CustomerCaller;

  public readonly sessionId: string;

  public constructor(caller: CustomerCaller, sessionId: string) {
    super(IDENTITY_COMMAND.REVOKE_SESSION);
    this.caller = caller;
    this.sessionId = sessionId;
  }
}
