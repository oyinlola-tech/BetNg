import { Query } from "@zudojs/cqrs";

/** Asks for the teams in one league, or in every league. */
export class ListTeamsQuery extends Query<"match.list-teams"> {
  /** Restricts the result to one league when present. */
  public readonly leagueId: string | undefined;

  public constructor(leagueId?: string) {
    super("match.list-teams");
    this.leagueId = leagueId;
  }
}
