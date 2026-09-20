import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../../../constants/index.js";

export class GetMatchQuery extends Query<"match.getMatch"> {
  public readonly matchId: string;

  public constructor(matchId: string) {
    super(MATCH_QUERY.GET_MATCH);
    this.matchId = matchId;
  }
}
