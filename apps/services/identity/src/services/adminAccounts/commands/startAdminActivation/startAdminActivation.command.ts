import { Command } from "@zudojs/cqrs";
import type { AdminActivationStart } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class StartAdminActivationCommand extends Command<"identity.startAdminActivation"> {
  public readonly request: AdminActivationStart;

  public readonly requestId: string;

  public constructor(payload: { readonly request: AdminActivationStart; readonly requestId: string }) {
    super(IDENTITY_COMMAND.START_ADMIN_ACTIVATION);
    this.request = payload.request;
    this.requestId = payload.requestId;
  }
}
