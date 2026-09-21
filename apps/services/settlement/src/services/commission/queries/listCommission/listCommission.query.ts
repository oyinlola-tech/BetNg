import { Query } from "@zudojs/cqrs";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";
import type { CommissionLedgerFilter } from "../../../../interfaces/index.js";

export class ListCommissionQuery extends Query<"settlement.listCommission"> {
  public readonly filter: CommissionLedgerFilter;

  public constructor(filter: CommissionLedgerFilter) {
    super(SETTLEMENT_QUERY.LIST_COMMISSION);
    this.filter = filter;
  }
}
