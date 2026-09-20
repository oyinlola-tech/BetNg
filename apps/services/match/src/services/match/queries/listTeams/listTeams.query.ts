import { Query } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../../../constants/index.js";

/** Asks for the teams in one league, or in every league. */
export class ListTeamsQuery extends Query<"match.listTeams"> {
  /** Restricts the result to one league when present. */
  public readonly leagueId: string | undefined;

  public constructor(leagueId?: string) {
    super(MATCH_QUERY.LIST_TEAMS);
    this.leagueId = leagueId;
  }
}
