import { QueryHandler } from "@zudojs/cqrs";
import type { Match } from "@betng/contracts";
import { MATCH_QUERY } from "../../../../constants/index.js";
import { MatchNotFoundError } from "../../../../errors/index.js";
import { toMatch } from "../../../../models/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { GetMatchQuery } from "./getMatch.query.js";

export class GetMatchHandler extends QueryHandler<GetMatchQuery, Match> {
  public readonly queryType = MATCH_QUERY.GET_MATCH;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetMatchQuery): Promise<Match> {
    const found = await this.deps.matches.findMatch(query.matchId);

    if (found === undefined) throw new MatchNotFoundError(query.matchId);

    return toMatch(found);
  }
}
