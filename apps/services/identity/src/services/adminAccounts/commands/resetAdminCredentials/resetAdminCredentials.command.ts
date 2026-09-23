import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AdminActor } from "../../../../interfaces/index.js";

export class ResetAdminCredentialsCommand extends Command<"identity.resetAdminCredentials"> {
  public readonly actor: AdminActor;

  public readonly adminId: string;

  public constructor(payload: { readonly actor: AdminActor; readonly adminId: string }) {
    super(IDENTITY_COMMAND.RESET_ADMIN_CREDENTIALS);
    this.actor = payload.actor;
    this.adminId = payload.adminId;
  }
}
