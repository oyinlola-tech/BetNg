import { Command } from "@zudojs/cqrs";
import type { PasswordChangeRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class ChangePasswordCommand extends Command<"identity.changePassword"> {
  public readonly caller: CustomerCaller;

  public readonly request: PasswordChangeRequest;

  public constructor(caller: CustomerCaller, request: PasswordChangeRequest) {
    super(IDENTITY_COMMAND.CHANGE_PASSWORD);
    this.caller = caller;
    this.request = request;
  }
}
