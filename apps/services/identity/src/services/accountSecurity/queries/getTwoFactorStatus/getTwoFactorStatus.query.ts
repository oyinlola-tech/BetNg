import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class GetTwoFactorStatusQuery extends Query<"identity.getTwoFactorStatus"> {
  public readonly caller: CustomerCaller;

  public constructor(caller: CustomerCaller) {
    super(IDENTITY_QUERY.GET_TWO_FACTOR_STATUS);
    this.caller = caller;
  }
}
