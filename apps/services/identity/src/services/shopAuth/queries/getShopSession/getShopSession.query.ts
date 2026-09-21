import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";

export class GetShopSessionQuery extends Query<"identity.getShopSession"> {
  public readonly token: string | undefined;

  public constructor(token: string | undefined) {
    super(IDENTITY_QUERY.GET_SHOP_SESSION);
    this.token = token;
  }
}
