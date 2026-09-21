import { QueryHandler } from "@zudojs/cqrs";
import type { CompletedMatch } from "@betng/contracts";
import { LIST_LIMIT, MATCH_QUERY } from "../../../../constants/index.js";
import { toCompletedMatch } from "../../../../models/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { ListResultsQuery } from "./listResults.query.js";

export class ListResultsHandler extends QueryHandler<ListResultsQuery, readonly CompletedMatch[]> {
  public readonly queryType = MATCH_QUERY.LIST_RESULTS;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListResultsQuery): Promise<readonly CompletedMatch[]> {
    const completed = await this.deps.matches.listCompleted({
      ...(query.leagueId === undefined ? {} : { leagueId: query.leagueId }),
      limit: query.limit ?? LIST_LIMIT.RESULTS_DEFAULT,
    });

    return completed.map(toCompletedMatch).filter((row) => row !== undefined);
  }
}
