import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class GetAccountDeletionQuery extends Query<"identity.getAccountDeletion"> {
  public readonly caller: CustomerCaller;

  public constructor(caller: CustomerCaller) {
    super(IDENTITY_QUERY.GET_ACCOUNT_DELETION);
    this.caller = caller;
  }
}
