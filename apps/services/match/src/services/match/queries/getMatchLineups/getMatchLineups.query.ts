import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../../../constants/index.js";

export class GetMatchLineupsQuery extends Query<"match.getMatchLineups"> {
  public readonly matchId: string;
  public readonly requestId: string;

  public constructor(matchId: string, requestId: string) {
    super(MATCH_QUERY.GET_MATCH_LINEUPS);
    this.matchId = matchId;
    this.requestId = requestId;
  }
}
