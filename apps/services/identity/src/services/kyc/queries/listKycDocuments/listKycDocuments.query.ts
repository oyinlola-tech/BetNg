import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class ListKycDocumentsQuery extends Query<"identity.listKycDocuments"> {
  public readonly caller: CustomerCaller;

  public constructor(caller: CustomerCaller) {
    super(IDENTITY_QUERY.LIST_KYC_DOCUMENTS);
    this.caller = caller;
  }
}
