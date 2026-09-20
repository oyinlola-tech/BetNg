import { Query } from "@zudojs/cqrs";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";

/** Asks for every settlement recorded so far. */
export class ListSettlementsQuery extends Query<"settlement.listSettlements"> {
  public constructor() {
    super(SETTLEMENT_QUERY.LIST_SETTLEMENTS);
  }
}
