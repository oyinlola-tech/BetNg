import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class ListLimitHistoryQuery extends Query<"identity.listLimitHistory"> {
  public readonly caller: CustomerCaller;

  public constructor(caller: CustomerCaller) {
    super(IDENTITY_QUERY.LIST_LIMIT_HISTORY);
    this.caller = caller;
  }
}
