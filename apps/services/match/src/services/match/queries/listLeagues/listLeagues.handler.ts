import { QueryHandler } from "@zudojs/cqrs";
import type { League } from "@betng/contracts";
import { MATCH_QUERY } from "../../../../constants/index.js";
import type { MatchRepository } from "../../../../interfaces/index.js";
import type { ListLeaguesQuery } from "./listLeagues.query.js";

/** Reads every league from the match repository. */
export class ListLeaguesHandler extends QueryHandler<
  ListLeaguesQuery,
  readonly League[]
> {
  public readonly queryType = MATCH_QUERY.LIST_LEAGUES;

  private readonly matches: MatchRepository;

  public constructor(matches: MatchRepository) {
    super();
    this.matches = matches;
  }

  public async execute(): Promise<readonly League[]> {
    return this.matches.listLeagues();
  }
}
