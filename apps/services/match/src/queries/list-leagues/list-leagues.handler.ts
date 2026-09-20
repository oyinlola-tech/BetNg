import { QueryHandler } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../constants/index.js";
import type { League } from "@betng/contracts";
import type { MatchRepository } from "../../interfaces/index.js";
import { ListLeaguesQuery } from "./list-leagues.query.js";

/** Reads every league from the match repository. */
export class ListLeaguesHandler extends QueryHandler<
  ListLeaguesQuery,
  readonly League[]
> {
  public readonly queryType = MATCH_QUERY.LIST_LEAGUES;

  private readonly repository: MatchRepository;

  public constructor(repository: MatchRepository) {
    super();
    this.repository = repository;
  }

  public async execute(): Promise<readonly League[]> {
    return this.repository.listLeagues();
  }
}
