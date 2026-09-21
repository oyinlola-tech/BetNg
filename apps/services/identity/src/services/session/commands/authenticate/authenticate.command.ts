import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class AuthenticateCommand extends Command<"identity.authenticate"> {
  public readonly token: string;

  public constructor(token: string) {
    super(IDENTITY_COMMAND.AUTHENTICATE);
    this.token = token;
  }
}
