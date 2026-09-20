import { QueryHandler } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../constants/index.js";
import type { Match } from "@betng/contracts";
import type { MatchFilter, MatchRepository } from "../../interfaces/index.js";
import { ListMatchesQuery } from "./list-matches.query.js";

/** Reads matches from the match repository. */
export class ListMatchesHandler extends QueryHandler<
  ListMatchesQuery,
  readonly Match[]
> {
  public readonly queryType = MATCH_QUERY.LIST_MATCHES;

  private readonly repository: MatchRepository;

  public constructor(repository: MatchRepository) {
    super();
    this.repository = repository;
  }

  public async execute(query: ListMatchesQuery): Promise<readonly Match[]> {
    const filter: MatchFilter = {
      ...(query.leagueId === undefined ? {} : { leagueId: query.leagueId }),
      ...(query.status === undefined ? {} : { status: query.status }),
    };

    return this.repository.listMatches(filter);
  }
}
