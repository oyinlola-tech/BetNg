import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { KycQueueFilter } from "../../../../interfaces/index.js";

export class ListKycQueueQuery extends Query<"identity.listKycQueue"> {
  public readonly filter: KycQueueFilter;

  public constructor(filter: KycQueueFilter) {
    super(IDENTITY_QUERY.LIST_KYC_QUEUE);
    this.filter = filter;
  }
}
