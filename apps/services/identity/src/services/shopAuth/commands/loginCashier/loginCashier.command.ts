import { Command } from "@zudojs/cqrs";
import type { ShopLoginRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class LoginCashierCommand extends Command<"identity.loginCashier"> {
  public readonly request: ShopLoginRequest;

  public constructor(request: ShopLoginRequest) {
    super(IDENTITY_COMMAND.LOGIN_CASHIER);
    this.request = request;
  }
}
