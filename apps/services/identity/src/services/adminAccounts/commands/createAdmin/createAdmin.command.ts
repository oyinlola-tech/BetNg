import { Command } from "@zudojs/cqrs";
import type { CreateAdminRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AdminActor } from "../../../../interfaces/index.js";

export class CreateAdminCommand extends Command<"identity.createAdmin"> {
  public readonly actor: AdminActor;

  public readonly request: CreateAdminRequest;

  public constructor(payload: { readonly actor: AdminActor; readonly request: CreateAdminRequest }) {
    super(IDENTITY_COMMAND.CREATE_ADMIN);
    this.actor = payload.actor;
    this.request = payload.request;
  }
}
