import { Command } from "@zudojs/cqrs";
import type { AdminActivateRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class ActivateAdminCommand extends Command<"identity.activateAdmin"> {
  public readonly request: AdminActivateRequest;

  public readonly requestId: string;

  public constructor(payload: { readonly request: AdminActivateRequest; readonly requestId: string }) {
    super(IDENTITY_COMMAND.ACTIVATE_ADMIN);
    this.request = payload.request;
    this.requestId = payload.requestId;
  }
}
