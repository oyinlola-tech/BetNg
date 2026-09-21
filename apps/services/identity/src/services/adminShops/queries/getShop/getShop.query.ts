import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";

export class GetShopQuery extends Query<"identity.getShop"> {
  public readonly shopId: string;

  public constructor(shopId: string) {
    super(IDENTITY_QUERY.GET_SHOP);
    this.shopId = shopId;
  }
}
