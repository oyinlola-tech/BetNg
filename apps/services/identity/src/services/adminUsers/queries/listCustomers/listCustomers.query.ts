import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";

export class ListCustomersQuery extends Query<"identity.listCustomers"> {
  public readonly q: string | undefined;

  public constructor(q: string | undefined) {
    super(IDENTITY_QUERY.LIST_CUSTOMERS);
    this.q = q;
  }
}
