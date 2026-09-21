import { Command } from "@zudojs/cqrs";
import type { CustomerRegisterRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class RegisterCustomerCommand extends Command<"identity.registerCustomer"> {
  public readonly request: CustomerRegisterRequest;

  public readonly requestId: string;

  public constructor(request: CustomerRegisterRequest, requestId: string) {
    super(IDENTITY_COMMAND.REGISTER_CUSTOMER);
    this.request = request;
    this.requestId = requestId;
  }
}
