import { QueryHandler } from "@zudojs/cqrs";
import { asId } from "@betng/contracts";
import type { Standings } from "@betng/contracts";
import { MATCH_QUERY } from "../../../../constants/index.js";
import { NotFoundError } from "../../../../errors/index.js";
import { computeStandings } from "../../../../utils/index.js";
import type { HandlerDependencies } from "../../match.dependencies.js";
import type { GetStandingsQuery } from "./getStandings.query.js";

const SEASON_MATCH_LIMIT = 5000;

export class GetStandingsHandler extends QueryHandler<GetStandingsQuery, Standings> {
  public readonly queryType = MATCH_QUERY.GET_STANDINGS;

  private readonly deps: HandlerDependencies;

  public constructor(deps: HandlerDependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: GetStandingsQuery): Promise<Standings> {
    const league = await this.deps.catalogue.findLeague(query.leagueId);

    if (league === undefined) throw new NotFoundError("league", query.leagueId);

    const now = this.deps.clock();
    const season = query.season ?? (await this.deps.matches.currentSeason(league.id, now));
    const teams = await this.deps.catalogue.listTeams(league.id);
    const completed = await this.deps.matches.listCompleted({ leagueId: league.id, season, limit: SEASON_MATCH_LIMIT });
    const rows = computeStandings(
      teams.map((team) => team.id),
      completed.map((match) => ({
        homeTeamId: match.fixture.homeTeamId,
        awayTeamId: match.fixture.awayTeamId,
        homeGoals: match.homeScore ?? 0,
        awayGoals: match.awayScore ?? 0,
        completedAt: match.completedAt ?? match.fixture.kickoffAt,
      })),
    );

    return {
      leagueId: asId<"LeagueId">(league.id),
      season,
      matchdaysPlayed: new Set(completed.map((match) => match.fixture.matchday)).size,
      rows: rows.map((row) => ({ ...row, teamId: asId<"TeamId">(row.teamId) })),
      generatedAt: now.toISOString(),
    };
  }
}
