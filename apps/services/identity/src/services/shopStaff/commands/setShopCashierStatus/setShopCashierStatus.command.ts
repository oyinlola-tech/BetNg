import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AccountStatus } from "../../../../generated/prisma/client.js";
import type { ShopActor } from "../../../../interfaces/index.js";

export class SetShopCashierStatusCommand extends Command<"identity.setShopCashierStatus"> {
  public readonly actor: ShopActor;

  public readonly cashierId: string;

  public readonly status: AccountStatus;

  public readonly reason: string;

  public constructor(payload: {
    readonly actor: ShopActor;
    readonly cashierId: string;
    readonly status: AccountStatus;
    readonly reason: string;
  }) {
    super(IDENTITY_COMMAND.SET_SHOP_CASHIER_STATUS);
    this.actor = payload.actor;
    this.cashierId = payload.cashierId;
    this.status = payload.status;
    this.reason = payload.reason;
  }
}
