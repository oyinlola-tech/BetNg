import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";

export class ListOwnShopCashiersQuery extends Query<"identity.listOwnShopCashiers"> {
  public readonly shopId: string;

  public constructor(shopId: string) {
    super(IDENTITY_QUERY.LIST_OWN_SHOP_CASHIERS);
    this.shopId = shopId;
  }
}
