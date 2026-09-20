import { QueryHandler } from "@zudojs/cqrs";
import type { Match } from "@betng/contracts";
import { MATCH_QUERY } from "../../../../constants/index.js";
import { MatchNotFoundError } from "../../../../errors/index.js";
import type { MatchRepository } from "../../../../interfaces/index.js";
import type { GetMatchQuery } from "./getMatch.query.js";

/**
 * Reads one match.
 *
 * Raises {@link MatchNotFoundError} rather than returning `undefined`, so
 * "no such match" is answered the same way whichever caller asked.
 */
export class GetMatchHandler extends QueryHandler<GetMatchQuery, Match> {
  public readonly queryType = MATCH_QUERY.GET_MATCH;

  private readonly matches: MatchRepository;

  public constructor(matches: MatchRepository) {
    super();
    this.matches = matches;
  }

  public async execute(query: GetMatchQuery): Promise<Match> {
    const found = await this.matches.findMatch(query.matchId);

    if (found === undefined) {
      throw new MatchNotFoundError(query.matchId);
    }

    return found;
  }
}
