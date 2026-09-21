import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AccountStatus } from "../../../../generated/prisma/client.js";
import type { AdminActor } from "../../../../interfaces/index.js";

export class SetCustomerStatusCommand extends Command<"identity.setCustomerStatus"> {
  public readonly actor: AdminActor;

  public readonly customerId: string;

  public readonly status: AccountStatus;

  public readonly reason: string;

  public constructor(payload: {
    readonly actor: AdminActor;
    readonly customerId: string;
    readonly status: AccountStatus;
    readonly reason: string;
  }) {
    super(IDENTITY_COMMAND.SET_CUSTOMER_STATUS);
    this.actor = payload.actor;
    this.customerId = payload.customerId;
    this.status = payload.status;
    this.reason = payload.reason;
  }
}
