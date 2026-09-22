import { Command } from "@zudojs/cqrs";
import type { TwoFactorConfirmRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class ConfirmTwoFactorCommand extends Command<"identity.confirmTwoFactor"> {
  public readonly caller: CustomerCaller;

  public readonly request: TwoFactorConfirmRequest;

  public constructor(caller: CustomerCaller, request: TwoFactorConfirmRequest) {
    super(IDENTITY_COMMAND.CONFIRM_TWO_FACTOR);
    this.caller = caller;
    this.request = request;
  }
}
