import { Query } from "@zudojs/cqrs";
import { BETTING_QUERY } from "../../../../constants/index.js";

export class GetBetQuery extends Query<"betting.getBet"> {
  public readonly betId: string;

  public readonly userId: string;

  public constructor(betId: string, userId: string) {
    super(BETTING_QUERY.GET_BET);
    this.betId = betId;
    this.userId = userId;
  }
}
