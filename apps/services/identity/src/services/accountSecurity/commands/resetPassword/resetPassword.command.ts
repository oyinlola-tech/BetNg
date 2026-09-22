import { Command } from "@zudojs/cqrs";
import type { PasswordResetConfirmRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class ResetPasswordCommand extends Command<"identity.resetPassword"> {
  public readonly request: PasswordResetConfirmRequest;

  public readonly requestId: string;

  public constructor(request: PasswordResetConfirmRequest, requestId: string) {
    super(IDENTITY_COMMAND.RESET_PASSWORD);
    this.request = request;
    this.requestId = requestId;
  }
}
