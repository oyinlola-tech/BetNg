import { Command } from "@zudojs/cqrs";
import type { UpdateAdminRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AdminActor } from "../../../../interfaces/index.js";

export class UpdateAdminCommand extends Command<"identity.updateAdmin"> {
  public readonly actor: AdminActor;

  public readonly adminId: string;

  public readonly request: UpdateAdminRequest;

  public constructor(payload: { readonly actor: AdminActor; readonly adminId: string; readonly request: UpdateAdminRequest }) {
    super(IDENTITY_COMMAND.UPDATE_ADMIN);
    this.actor = payload.actor;
    this.adminId = payload.adminId;
    this.request = payload.request;
  }
}
