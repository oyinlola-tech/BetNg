import { Command } from "@zudojs/cqrs";
import type { TwoFactorDisableRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class DisableTwoFactorCommand extends Command<"identity.disableTwoFactor"> {
  public readonly caller: CustomerCaller;

  public readonly request: TwoFactorDisableRequest;

  public constructor(caller: CustomerCaller, request: TwoFactorDisableRequest) {
    super(IDENTITY_COMMAND.DISABLE_TWO_FACTOR);
    this.caller = caller;
    this.request = request;
  }
}
