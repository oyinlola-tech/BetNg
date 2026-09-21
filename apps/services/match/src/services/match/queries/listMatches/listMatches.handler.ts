import { QueryHandler } from "@zudojs/cqrs";
import type { Match } from "@betng/contracts";
import { LIST_LIMIT, MATCH_QUERY } from "../../../../constants/index.js";
import { toMatch } from "../../../../models/index.js";
import { resolveWindow } from "../../../../utils/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { ListMatchesQuery } from "./listMatches.query.js";

export class ListMatchesHandler extends QueryHandler<
  ListMatchesQuery,
  readonly Match[]
> {
  public readonly queryType = MATCH_QUERY.LIST_MATCHES;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListMatchesQuery): Promise<readonly Match[]> {
    const { filter } = query;
    const recentResults =
      filter.status === "COMPLETED" &&
      filter.from === undefined &&
      filter.to === undefined;
    const window = resolveWindow(
      filter,
      this.deps.clock(),
      recentResults || filter.matchday !== undefined,
    );
    const matches = await this.deps.matches.listMatches({
      ...(filter.leagueId === undefined ? {} : { leagueId: filter.leagueId }),
      ...(filter.status === undefined ? {} : { status: filter.status }),
      ...(filter.season === undefined ? {} : { season: filter.season }),
      ...(filter.matchday === undefined ? {} : { matchday: filter.matchday }),
      ...window,
      newestFirst: recentResults,
      limit: filter.limit ?? LIST_LIMIT.DEFAULT,
    });

    return matches.map(toMatch);
  }
}
