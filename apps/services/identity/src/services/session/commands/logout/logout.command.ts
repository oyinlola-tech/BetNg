import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { SessionKind } from "../../../../generated/prisma/client.js";

export class LogoutCommand extends Command<"identity.logout"> {
  public readonly token: string | undefined;

  public readonly kind: SessionKind;

  public readonly requestId: string;

  public constructor(token: string | undefined, kind: SessionKind, requestId: string) {
    super(IDENTITY_COMMAND.LOGOUT);
    this.token = token;
    this.kind = kind;
    this.requestId = requestId;
  }
}
