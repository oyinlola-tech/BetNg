import { QueryHandler } from "@zudojs/cqrs";
import type { League } from "@betng/contracts";
import { MATCH_QUERY } from "../../../../constants/index.js";
import { toLeague } from "../../../../models/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { ListLeaguesQuery } from "./listLeagues.query.js";

export class ListLeaguesHandler extends QueryHandler<ListLeaguesQuery, readonly League[]> {
  public readonly queryType = MATCH_QUERY.LIST_LEAGUES;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(_query: ListLeaguesQuery): Promise<readonly League[]> {
    return (await this.deps.catalogue.listLeagues()).map(toLeague);
  }
}
