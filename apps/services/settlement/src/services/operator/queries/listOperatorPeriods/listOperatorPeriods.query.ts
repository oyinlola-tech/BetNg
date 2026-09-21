import { Query } from "@zudojs/cqrs";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";

export class ListOperatorPeriodsQuery extends Query<"settlement.listOperatorPeriods"> {
  public readonly limit: number;

  public constructor(limit: number) {
    super(SETTLEMENT_QUERY.LIST_OPERATOR_PERIODS);
    this.limit = limit;
  }
}
