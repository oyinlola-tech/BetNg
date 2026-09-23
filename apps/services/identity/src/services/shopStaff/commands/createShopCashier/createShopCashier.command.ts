import { Command } from "@zudojs/cqrs";
import type { CreateCashierRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { ShopActor } from "../../../../interfaces/index.js";

export class CreateShopCashierCommand extends Command<"identity.createShopCashier"> {
  public readonly actor: ShopActor;

  public readonly request: CreateCashierRequest;

  public constructor(payload: { readonly actor: ShopActor; readonly request: CreateCashierRequest }) {
    super(IDENTITY_COMMAND.CREATE_SHOP_CASHIER);
    this.actor = payload.actor;
    this.request = payload.request;
  }
}
