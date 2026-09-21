import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../../../constants/index.js";

export class GetHeadToHeadQuery extends Query<"match.getHeadToHead"> {
  public readonly matchId: string;

  public constructor(matchId: string) {
    super(MATCH_QUERY.GET_HEAD_TO_HEAD);
    this.matchId = matchId;
  }
}
