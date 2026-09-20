import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../../../constants/index.js";

export class ListTeamsQuery extends Query<"match.listTeams"> {
  public readonly leagueId: string | undefined;

  public constructor(leagueId?: string) {
    super(MATCH_QUERY.LIST_TEAMS);
    this.leagueId = leagueId;
  }
}
