import { Query } from "@zudojs/cqrs";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";
import type { SettlementFilter } from "../../../../interfaces/index.js";

export class ListSettlementsQuery extends Query<"settlement.listSettlements"> {
  public readonly filter: SettlementFilter;

  public constructor(filter: SettlementFilter) {
    super(SETTLEMENT_QUERY.LIST_SETTLEMENTS);
    this.filter = filter;
  }
}
