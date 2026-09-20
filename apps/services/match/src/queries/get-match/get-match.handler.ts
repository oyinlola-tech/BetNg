import { QueryHandler } from "@zudojs/cqrs";
import type { Match } from "@betng/contracts";
import type { MatchRepository } from "../../interfaces/index.js";
import { MatchNotFoundError } from "../../errors/index.js";
import { GetMatchQuery } from "./get-match.query.js";

/**
 * Reads one match.
 *
 * Raises {@link MatchNotFoundError} rather than returning `undefined`, so
 * "no such match" is answered the same way whichever caller asked.
 */
export class GetMatchHandler extends QueryHandler<GetMatchQuery, Match> {
  public readonly queryType = "match.get-match" as const;

  private readonly repository: MatchRepository;

  public constructor(repository: MatchRepository) {
    super();
    this.repository = repository;
  }

  public async execute(query: GetMatchQuery): Promise<Match> {
    const found = await this.repository.findMatch(query.matchId);

    if (found === undefined) {
      throw new MatchNotFoundError(query.matchId);
    }

    return found;
  }
}
