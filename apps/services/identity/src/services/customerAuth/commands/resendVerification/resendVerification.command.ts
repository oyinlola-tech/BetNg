import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class ResendVerificationCommand extends Command<"identity.resendVerification"> {
  public readonly email: string;

  public readonly requestId: string;

  public constructor(email: string, requestId: string) {
    super(IDENTITY_COMMAND.RESEND_VERIFICATION);
    this.email = email;
    this.requestId = requestId;
  }
}
