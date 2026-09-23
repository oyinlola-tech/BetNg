import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { ShopActor } from "../../../../interfaces/index.js";

export class ResetShopCashierCredentialsCommand extends Command<"identity.resetShopCashierCredentials"> {
  public readonly actor: ShopActor;

  public readonly cashierId: string;

  public constructor(payload: { readonly actor: ShopActor; readonly cashierId: string }) {
    super(IDENTITY_COMMAND.RESET_SHOP_CASHIER_CREDENTIALS);
    this.actor = payload.actor;
    this.cashierId = payload.cashierId;
  }
}
