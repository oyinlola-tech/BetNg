import { Query } from "@zudojs/cqrs";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";
import type { AdminSettlementFilter } from "../../../../interfaces/index.js";

export class ListAdminSettlementsQuery extends Query<"settlement.listAdminSettlements"> {
  public readonly filter: AdminSettlementFilter;

  public constructor(filter: AdminSettlementFilter) {
    super(SETTLEMENT_QUERY.LIST_ADMIN_SETTLEMENTS);
    this.filter = filter;
  }
}
