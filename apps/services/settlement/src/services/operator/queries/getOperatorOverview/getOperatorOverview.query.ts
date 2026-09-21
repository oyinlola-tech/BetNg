import { Query } from "@zudojs/cqrs";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";

export class GetOperatorOverviewQuery extends Query<"settlement.getOperatorOverview"> {
  public readonly closedLimit: number;

  public constructor(closedLimit: number) {
    super(SETTLEMENT_QUERY.GET_OPERATOR_OVERVIEW);
    this.closedLimit = closedLimit;
  }
}
