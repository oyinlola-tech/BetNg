import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";

export class ListAdminsQuery extends Query<"identity.listAdmins"> {
  public constructor() {
    super(IDENTITY_QUERY.LIST_ADMINS);
  }
}
