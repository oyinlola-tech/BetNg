import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../constants/index.js";

/** Asks for one match by identifier. */
export class GetMatchQuery extends Query<"match.get-match"> {
  public readonly matchId: string;

  public constructor(matchId: string) {
    super(MATCH_QUERY.GET_MATCH);
    this.matchId = matchId;
  }
}
