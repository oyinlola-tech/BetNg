import { QueryHandler } from "@zudojs/cqrs";
import type { Team } from "@betng/contracts";
import { MATCH_QUERY } from "../../../../constants/index.js";
import type { MatchRepository } from "../../../../interfaces/index.js";
import type { ListTeamsQuery } from "./listTeams.query.js";

/** Reads teams from the match repository, optionally by league. */
export class ListTeamsHandler extends QueryHandler<
  ListTeamsQuery,
  readonly Team[]
> {
  public readonly queryType = MATCH_QUERY.LIST_TEAMS;

  private readonly matches: MatchRepository;

  public constructor(matches: MatchRepository) {
    super();
    this.matches = matches;
  }

  public async execute(query: ListTeamsQuery): Promise<readonly Team[]> {
    return this.matches.listTeams(query.leagueId);
  }
}
