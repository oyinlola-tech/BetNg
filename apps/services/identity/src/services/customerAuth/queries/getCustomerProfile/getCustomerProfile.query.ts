import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";

export class GetCustomerProfileQuery extends Query<"identity.getCustomerProfile"> {
  public readonly token: string | undefined;

  public constructor(token: string | undefined) {
    super(IDENTITY_QUERY.GET_CUSTOMER_PROFILE);
    this.token = token;
  }
}
