import { Query } from "@zudojs/cqrs";
import { BETTING_QUERY } from "../../../../constants/index.js";

export class GetBetQuery extends Query<"betting.getBet"> {
  public readonly betId: string;

  public constructor(betId: string) {
    super(BETTING_QUERY.GET_BET);
    this.betId = betId;
  }
}
