import { QueryHandler } from "@zudojs/cqrs";
import type { Fixture } from "@betng/contracts";
import { LIST_LIMIT, MATCH_QUERY } from "../../../../constants/index.js";
import { toFixture } from "../../../../models/index.js";
import { resolveWindow } from "../../../../utils/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { ListFixturesQuery } from "./listFixtures.query.js";

export class ListFixturesHandler extends QueryHandler<ListFixturesQuery, readonly Fixture[]> {
  public readonly queryType = MATCH_QUERY.LIST_FIXTURES;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListFixturesQuery): Promise<readonly Fixture[]> {
    const { filter } = query;
    const window = resolveWindow(filter, this.deps.clock(), filter.matchday !== undefined);
    const fixtures = await this.deps.matches.listFixtures({
      ...(filter.leagueId === undefined ? {} : { leagueId: filter.leagueId }),
      ...(filter.season === undefined ? {} : { season: filter.season }),
      ...(filter.matchday === undefined ? {} : { matchday: filter.matchday }),
      ...window,
      limit: filter.limit ?? LIST_LIMIT.MAX,
    });

    return fixtures.map(toFixture);
  }
}
