import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";

export class ListShopCashiersQuery extends Query<"identity.listShopCashiers"> {
  public readonly shopId: string;

  public constructor(shopId: string) {
    super(IDENTITY_QUERY.LIST_SHOP_CASHIERS);
    this.shopId = shopId;
  }
}
