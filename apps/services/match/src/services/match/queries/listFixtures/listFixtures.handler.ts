import { QueryHandler } from "@zudojs/cqrs";
import type { Fixture } from "@betng/contracts";
import { LIST_LIMIT, MATCH_QUERY } from "../../../../constants/index.js";
import type { PageDto } from "../../../../dtos/index.js";
import { toFixture } from "../../../../models/index.js";
import { resolveWindow, toPage } from "../../../../utils/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { ListFixturesQuery } from "./listFixtures.query.js";

export class ListFixturesHandler extends QueryHandler<
  ListFixturesQuery,
  PageDto<Fixture>
> {
  public readonly queryType = MATCH_QUERY.LIST_FIXTURES;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListFixturesQuery): Promise<PageDto<Fixture>> {
    const { filter } = query;
    const limit = filter.limit ?? LIST_LIMIT.MAX;
    const window = resolveWindow(
      filter,
      this.deps.clock(),
      filter.matchday !== undefined,
    );
    const fixtures = await this.deps.matches.listFixtures({
      ...(filter.leagueId === undefined ? {} : { leagueId: filter.leagueId }),
      ...(filter.season === undefined ? {} : { season: filter.season }),
      ...(filter.matchday === undefined ? {} : { matchday: filter.matchday }),
      ...window,
      limit: limit + 1,
    });
    const page = toPage(fixtures, limit);

    return { items: page.items.map(toFixture), truncated: page.truncated };
  }
}
