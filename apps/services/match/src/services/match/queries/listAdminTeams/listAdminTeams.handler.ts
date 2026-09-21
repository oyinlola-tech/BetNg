import { QueryHandler } from "@zudojs/cqrs";
import type { AdminTeam } from "@betng/contracts";
import { MATCH_QUERY } from "../../../../constants/index.js";
import { toAdminTeam } from "../../../../models/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { ListAdminTeamsQuery } from "./listAdminTeams.query.js";

export class ListAdminTeamsHandler extends QueryHandler<
  ListAdminTeamsQuery,
  readonly AdminTeam[]
> {
  public readonly queryType = MATCH_QUERY.LIST_ADMIN_TEAMS;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(
    query: ListAdminTeamsQuery,
  ): Promise<readonly AdminTeam[]> {
    return (await this.deps.catalogue.listTeams(query.leagueId)).map(
      toAdminTeam,
    );
  }
}
