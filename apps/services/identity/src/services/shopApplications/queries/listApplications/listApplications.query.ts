import { Query } from "@zudojs/cqrs";
import type { ShopApplicationStatus } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";

export class ListShopApplicationsQuery extends Query<"identity.listShopApplications"> {
  public readonly status: ShopApplicationStatus | undefined;

  public constructor(status?: ShopApplicationStatus) {
    super(IDENTITY_QUERY.LIST_SHOP_APPLICATIONS);
    this.status = status;
  }
}
