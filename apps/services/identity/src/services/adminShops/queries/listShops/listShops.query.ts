import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";

export class ListShopsQuery extends Query<"identity.listShops"> {
  public constructor() {
    super(IDENTITY_QUERY.LIST_SHOPS);
  }
}
