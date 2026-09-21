import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../../../constants/index.js";

export class GetMatchStatsQuery extends Query<"match.getMatchStats"> {
  public readonly matchId: string;

  public constructor(matchId: string) {
    super(MATCH_QUERY.GET_MATCH_STATS);
    this.matchId = matchId;
  }
}
