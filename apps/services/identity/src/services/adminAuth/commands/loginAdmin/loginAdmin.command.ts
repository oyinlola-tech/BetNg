import { Command } from "@zudojs/cqrs";
import type { AdminLoginRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class LoginAdminCommand extends Command<"identity.loginAdmin"> {
  public readonly request: AdminLoginRequest;

  public readonly requestId: string;

  public constructor(request: AdminLoginRequest, requestId: string) {
    super(IDENTITY_COMMAND.LOGIN_ADMIN);
    this.request = request;
    this.requestId = requestId;
  }
}
