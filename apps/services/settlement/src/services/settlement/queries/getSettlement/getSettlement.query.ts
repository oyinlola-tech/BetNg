import { Query } from "@zudojs/cqrs";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";

export class GetSettlementQuery extends Query<"settlement.getSettlement"> {
  public readonly betId: string;
  /** Set for a customer: someone else's bet answers exactly like a bet that does not exist. */
  public readonly userId: string | undefined;

  public constructor(betId: string, userId?: string) {
    super(SETTLEMENT_QUERY.GET_SETTLEMENT);
    this.betId = betId;
    this.userId = userId;
  }
}
