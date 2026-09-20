import { QueryHandler } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../constants/index.js";
import type { Team } from "@betng/contracts";
import type { MatchRepository } from "../../interfaces/index.js";
import { ListTeamsQuery } from "./list-teams.query.js";

/** Reads teams from the match repository, optionally by league. */
export class ListTeamsHandler extends QueryHandler<
  ListTeamsQuery,
  readonly Team[]
> {
  public readonly queryType = MATCH_QUERY.LIST_TEAMS;

  private readonly repository: MatchRepository;

  public constructor(repository: MatchRepository) {
    super();
    this.repository = repository;
  }

  public async execute(query: ListTeamsQuery): Promise<readonly Team[]> {
    return this.repository.listTeams(query.leagueId);
  }
}
