import { QueryHandler } from "@zudojs/cqrs";
import type { Match } from "@betng/contracts";
import { LIST_LIMIT, MATCH_QUERY } from "../../../../constants/index.js";
import type { PageDto } from "../../../../dtos/index.js";
import { toMatch } from "../../../../models/index.js";
import { resolveWindow, toPage } from "../../../../utils/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { ListMatchesQuery } from "./listMatches.query.js";

export class ListMatchesHandler extends QueryHandler<
  ListMatchesQuery,
  PageDto<Match>
> {
  public readonly queryType = MATCH_QUERY.LIST_MATCHES;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListMatchesQuery): Promise<PageDto<Match>> {
    const { filter } = query;
    const limit = filter.limit ?? LIST_LIMIT.DEFAULT;
    const recentResults =
      filter.status === "COMPLETED" &&
      filter.from === undefined &&
      filter.to === undefined;
    const now = this.deps.clock();
    const window = resolveWindow(
      filter,
      now,
      recentResults || filter.matchday !== undefined,
    );
    const matches = await this.deps.matches.listMatches({
      ...(filter.leagueId === undefined ? {} : { leagueId: filter.leagueId }),
      ...(filter.status === undefined ? {} : { status: filter.status }),
      ...(filter.season === undefined ? {} : { season: filter.season }),
      ...(filter.matchday === undefined ? {} : { matchday: filter.matchday }),
      ...window,
      newestFirst: filter.status === "COMPLETED",
      limit: limit + 1,
    });
    const page = toPage(matches, limit);

    return {
      items: page.items.map((match) =>
        toMatch(match, { now, timing: this.deps.timing }),
      ),
      truncated: page.truncated,
    };
  }
}
