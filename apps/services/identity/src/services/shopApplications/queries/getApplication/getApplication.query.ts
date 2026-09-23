import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";

export class GetShopApplicationQuery extends Query<"identity.getShopApplication"> {
  public readonly applicationId: string;

  public constructor(applicationId: string) {
    super(IDENTITY_QUERY.GET_SHOP_APPLICATION);
    this.applicationId = applicationId;
  }
}
