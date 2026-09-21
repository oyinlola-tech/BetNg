import { Command } from "@zudojs/cqrs";
import type { VerifyEmailRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class VerifyEmailCommand extends Command<"identity.verifyEmail"> {
  public readonly request: VerifyEmailRequest;

  public constructor(request: VerifyEmailRequest) {
    super(IDENTITY_COMMAND.VERIFY_EMAIL);
    this.request = request;
  }
}
