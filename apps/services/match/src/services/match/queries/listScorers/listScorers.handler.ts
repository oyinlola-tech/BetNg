import { QueryHandler } from "@zudojs/cqrs";
import { asId } from "@betng/contracts";
import type { TopScorer } from "@betng/contracts";
import { LIST_LIMIT, MATCH_QUERY } from "../../../../constants/index.js";
import { NotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { ListScorersQuery } from "./listScorers.query.js";

export class ListScorersHandler extends QueryHandler<ListScorersQuery, readonly TopScorer[]> {
  public readonly queryType = MATCH_QUERY.LIST_SCORERS;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListScorersQuery): Promise<readonly TopScorer[]> {
    const league = await this.deps.catalogue.findLeague(query.leagueId);

    if (league === undefined) throw new NotFoundError("league", query.leagueId);

    const season = query.season ?? (await this.deps.matches.currentSeason(league.id, this.deps.clock()));
    const scorers = await this.deps.simulation.listScorers(league.id, season, query.limit ?? LIST_LIMIT.SCORERS_DEFAULT);

    return scorers.map((row) => ({ ...row, player: row.player.slice(0, 80), teamId: asId<"TeamId">(row.teamId) }));
  }
}
