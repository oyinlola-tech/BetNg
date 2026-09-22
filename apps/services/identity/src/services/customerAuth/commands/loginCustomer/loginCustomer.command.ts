import { Command } from "@zudojs/cqrs";
import type { CustomerLoginRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class LoginCustomerCommand extends Command<"identity.loginCustomer"> {
  public readonly request: CustomerLoginRequest;

  public readonly userAgent: string | undefined;

  public constructor(request: CustomerLoginRequest, userAgent?: string) {
    super(IDENTITY_COMMAND.LOGIN_CUSTOMER);
    this.request = request;
    this.userAgent = userAgent;
  }
}
