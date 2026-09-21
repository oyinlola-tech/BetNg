import { QueryHandler } from "@zudojs/cqrs";
import type { AdminFixture } from "@betng/contracts";
import { LIST_LIMIT, MATCH_QUERY } from "../../../../constants/index.js";
import { toAdminFixture } from "../../../../models/index.js";
import { resolveWindow } from "../../../../utils/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { ListAdminFixturesQuery } from "./listAdminFixtures.query.js";

export class ListAdminFixturesHandler extends QueryHandler<
  ListAdminFixturesQuery,
  readonly AdminFixture[]
> {
  public readonly queryType = MATCH_QUERY.LIST_ADMIN_FIXTURES;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(
    query: ListAdminFixturesQuery,
  ): Promise<readonly AdminFixture[]> {
    const { filter } = query;
    const window = resolveWindow(
      filter,
      this.deps.clock(),
      filter.matchday !== undefined,
    );
    const matches = await this.deps.matches.listMatches({
      ...(filter.leagueId === undefined ? {} : { leagueId: filter.leagueId }),
      ...(filter.matchStatus === undefined
        ? {}
        : { status: filter.matchStatus }),
      ...(filter.season === undefined ? {} : { season: filter.season }),
      ...(filter.matchday === undefined ? {} : { matchday: filter.matchday }),
      ...window,
      limit: filter.limit ?? LIST_LIMIT.MAX,
    });

    return matches.map(toAdminFixture);
  }
}
