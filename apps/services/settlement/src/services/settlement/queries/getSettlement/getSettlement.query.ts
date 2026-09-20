import { Query } from "@zudojs/cqrs";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";

export class GetSettlementQuery extends Query<"settlement.getSettlement"> {
  public readonly betId: string;

  public constructor(betId: string) {
    super(SETTLEMENT_QUERY.GET_SETTLEMENT);
    this.betId = betId;
  }
}
