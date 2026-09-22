import { Command } from "@zudojs/cqrs";
import type { UpdateProfileRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class UpdateCustomerProfileCommand extends Command<"identity.updateCustomerProfile"> {
  public readonly caller: CustomerCaller;

  public readonly request: UpdateProfileRequest;

  public constructor(caller: CustomerCaller, request: UpdateProfileRequest) {
    super(IDENTITY_COMMAND.UPDATE_CUSTOMER_PROFILE);
    this.caller = caller;
    this.request = request;
  }
}
