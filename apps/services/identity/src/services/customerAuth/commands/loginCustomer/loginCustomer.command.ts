import { Command } from "@zudojs/cqrs";
import type { CustomerLoginRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class LoginCustomerCommand extends Command<"identity.loginCustomer"> {
  public readonly request: CustomerLoginRequest;

  public constructor(request: CustomerLoginRequest) {
    super(IDENTITY_COMMAND.LOGIN_CUSTOMER);
    this.request = request;
  }
}
