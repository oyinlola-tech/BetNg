import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../../../constants/index.js";

export class ListAdminTeamsQuery extends Query<"match.listAdminTeams"> {
  public readonly leagueId: string | undefined;

  public constructor(leagueId: string | undefined) {
    super(MATCH_QUERY.LIST_ADMIN_TEAMS);
    this.leagueId = leagueId;
  }
}
