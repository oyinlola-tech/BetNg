import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class GetKycOverviewQuery extends Query<"identity.getKycOverview"> {
  public readonly caller: CustomerCaller;

  public constructor(caller: CustomerCaller) {
    super(IDENTITY_QUERY.GET_KYC_OVERVIEW);
    this.caller = caller;
  }
}
