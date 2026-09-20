import { QueryHandler } from "@zudojs/cqrs";
import type { Team } from "@betng/contracts";
import type { MatchRepository } from "../../interfaces/index.js";
import { ListTeamsQuery } from "./list-teams.query.js";

/** Reads teams from the match repository, optionally by league. */
export class ListTeamsHandler extends QueryHandler<
  ListTeamsQuery,
  readonly Team[]
> {
  public readonly queryType = "match.list-teams" as const;

  private readonly repository: MatchRepository;

  public constructor(repository: MatchRepository) {
    super();
    this.repository = repository;
  }

  public async execute(query: ListTeamsQuery): Promise<readonly Team[]> {
    return this.repository.listTeams(query.leagueId);
  }
}
