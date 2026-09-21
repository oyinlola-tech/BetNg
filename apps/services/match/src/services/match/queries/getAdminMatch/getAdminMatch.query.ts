import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../../../constants/index.js";

export class GetAdminMatchQuery extends Query<"match.getAdminMatch"> {
  public readonly matchId: string;

  public constructor(matchId: string) {
    super(MATCH_QUERY.GET_ADMIN_MATCH);
    this.matchId = matchId;
  }
}
