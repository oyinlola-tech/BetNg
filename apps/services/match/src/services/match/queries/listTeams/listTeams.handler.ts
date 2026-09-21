import { QueryHandler } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../../../constants/index.js";
import type { TeamDto } from "../../../../dtos/index.js";
import { toTeam } from "../../../../models/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { ListTeamsQuery } from "./listTeams.query.js";

export class ListTeamsHandler extends QueryHandler<
  ListTeamsQuery,
  readonly TeamDto[]
> {
  public readonly queryType = MATCH_QUERY.LIST_TEAMS;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListTeamsQuery): Promise<readonly TeamDto[]> {
    return (await this.deps.catalogue.listTeams(query.leagueId)).map(toTeam);
  }
}
