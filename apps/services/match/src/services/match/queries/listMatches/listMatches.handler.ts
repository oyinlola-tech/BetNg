import { QueryHandler } from "@zudojs/cqrs";
import type { Match } from "@betng/contracts";
import { MATCH_QUERY } from "../../../../constants/index.js";
import type {
  MatchFilter,
  MatchRepository,
} from "../../../../interfaces/index.js";
import type { ListMatchesQuery } from "./listMatches.query.js";

export class ListMatchesHandler extends QueryHandler<
  ListMatchesQuery,
  readonly Match[]
> {
  public readonly queryType = MATCH_QUERY.LIST_MATCHES;

  private readonly matches: MatchRepository;

  public constructor(matches: MatchRepository) {
    super();
    this.matches = matches;
  }

  public async execute(query: ListMatchesQuery): Promise<readonly Match[]> {
    const filter: MatchFilter = {
      ...(query.leagueId === undefined ? {} : { leagueId: query.leagueId }),
      ...(query.status === undefined ? {} : { status: query.status }),
    };

    return this.matches.listMatches(filter);
  }
}
