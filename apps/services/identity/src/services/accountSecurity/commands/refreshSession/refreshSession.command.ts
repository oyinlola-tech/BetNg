import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class RefreshSessionCommand extends Command<"identity.refreshSession"> {
  public readonly caller: CustomerCaller;

  public constructor(caller: CustomerCaller) {
    super(IDENTITY_COMMAND.REFRESH_SESSION);
    this.caller = caller;
  }
}
