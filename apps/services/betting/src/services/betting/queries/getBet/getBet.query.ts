import { Query } from "@zudojs/cqrs";
import { BETTING_QUERY } from "../../../../constants/index.js";

export class GetBetQuery extends Query<"betting.getBet"> {
  public readonly betId: string;

  /** The customer asking. A bet that is not theirs does not exist for them. */
  public readonly userId: string;

  public constructor(betId: string, userId: string) {
    super(BETTING_QUERY.GET_BET);
    this.betId = betId;
    this.userId = userId;
  }
}
