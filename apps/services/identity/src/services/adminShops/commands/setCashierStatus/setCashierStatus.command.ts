import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AccountStatus } from "../../../../generated/prisma/client.js";
import type { AdminActor } from "../../../../interfaces/index.js";

export class SetCashierStatusCommand extends Command<"identity.setCashierStatus"> {
  public readonly actor: AdminActor;

  public readonly shopId: string;

  public readonly cashierId: string;

  public readonly status: AccountStatus;

  public readonly reason: string;

  public constructor(payload: {
    readonly actor: AdminActor;
    readonly shopId: string;
    readonly cashierId: string;
    readonly status: AccountStatus;
    readonly reason: string;
  }) {
    super(IDENTITY_COMMAND.SET_CASHIER_STATUS);
    this.actor = payload.actor;
    this.shopId = payload.shopId;
    this.cashierId = payload.cashierId;
    this.status = payload.status;
    this.reason = payload.reason;
  }
}
