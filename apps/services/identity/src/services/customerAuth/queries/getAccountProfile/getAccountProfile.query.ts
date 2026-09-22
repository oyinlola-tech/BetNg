import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class GetAccountProfileQuery extends Query<"identity.getAccountProfile"> {
  public readonly caller: CustomerCaller;

  public constructor(caller: CustomerCaller) {
    super(IDENTITY_QUERY.GET_ACCOUNT_PROFILE);
    this.caller = caller;
  }
}
