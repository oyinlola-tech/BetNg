import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class RequestPasswordResetCommand extends Command<"identity.requestPasswordReset"> {
  public readonly email: string;

  public readonly requestId: string;

  public constructor(email: string, requestId = "") {
    super(IDENTITY_COMMAND.REQUEST_PASSWORD_RESET);
    this.email = email;
    this.requestId = requestId;
  }
}
