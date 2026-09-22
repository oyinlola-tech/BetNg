import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AdminActor } from "../../../../interfaces/index.js";

export class AdminUpdateCustomerCommand extends Command<"identity.adminUpdateCustomer"> {
  public readonly actor: AdminActor;

  public readonly customerId: string;

  public readonly changes: { readonly displayName?: string | undefined; readonly phone?: string | undefined };

  public readonly reason: string;

  public constructor(payload: {
    readonly actor: AdminActor;
    readonly customerId: string;
    readonly changes: { readonly displayName?: string | undefined; readonly phone?: string | undefined };
    readonly reason: string;
  }) {
    super(IDENTITY_COMMAND.ADMIN_UPDATE_CUSTOMER);
    this.actor = payload.actor;
    this.customerId = payload.customerId;
    this.changes = payload.changes;
    this.reason = payload.reason;
  }
}
