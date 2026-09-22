import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class GetLimitsSummaryQuery extends Query<"identity.getLimitsSummary"> {
  public readonly caller: CustomerCaller;

  public constructor(caller: CustomerCaller) {
    super(IDENTITY_QUERY.GET_LIMITS_SUMMARY);
    this.caller = caller;
  }
}
