import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AdminActor } from "../../../../interfaces/index.js";

export class AdminSendPasswordResetCommand extends Command<"identity.adminSendPasswordReset"> {
  public readonly actor: AdminActor;

  public readonly customerId: string;

  public readonly reason: string;

  public constructor(payload: { readonly actor: AdminActor; readonly customerId: string; readonly reason: string }) {
    super(IDENTITY_COMMAND.ADMIN_SEND_PASSWORD_RESET);
    this.actor = payload.actor;
    this.customerId = payload.customerId;
    this.reason = payload.reason;
  }
}
