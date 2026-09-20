import { Query } from "@zudojs/cqrs";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";

export class ListSettlementsQuery extends Query<"settlement.listSettlements"> {
  public constructor() {
    super(SETTLEMENT_QUERY.LIST_SETTLEMENTS);
  }
}
