import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class ListAccountSessionsQuery extends Query<"identity.listAccountSessions"> {
  public readonly caller: CustomerCaller;

  public constructor(caller: CustomerCaller) {
    super(IDENTITY_QUERY.LIST_ACCOUNT_SESSIONS);
    this.caller = caller;
  }
}
