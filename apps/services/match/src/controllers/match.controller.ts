import type {
  CompletedMatch,
  Fixture,
  League,
  Match,
  MatchEvent,
  MatchStats,
  Standings,
  TopScorer,
} from "@betng/contracts";
import { parseQuery, requireParam } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import type { QueryBus } from "@zudojs/cqrs";
import type { ItemsDto, TeamDto } from "../dtos/index.js";
import { NotFoundError } from "../errors/index.js";
import {
  GetMatchQuery,
  GetMatchStatsQuery,
  GetStandingsQuery,
  ListFixturesQuery,
  ListLeaguesQuery,
  ListMatchEventsQuery,
  ListMatchesQuery,
  ListResultsQuery,
  ListScorersQuery,
  ListTeamsQuery,
} from "../services/match/queries/index.js";
import {
  isUuid,
  listFixturesQueryValidator,
  listMatchesQueryValidator,
  listResultsQueryValidator,
  listTeamsQueryValidator,
  seasonQueryValidator,
} from "../validators/index.js";

export interface MatchController {
  listLeagues(): Promise<ItemsDto<League>>;
  listTeams(context: HttpRouterContext): Promise<ItemsDto<TeamDto>>;
  listFixtures(context: HttpRouterContext): Promise<ItemsDto<Fixture>>;
  listMatches(context: HttpRouterContext): Promise<ItemsDto<Match>>;
  getMatch(context: HttpRouterContext): Promise<Match>;
  listMatchEvents(context: HttpRouterContext): Promise<ItemsDto<MatchEvent>>;
  getMatchStats(context: HttpRouterContext): Promise<MatchStats>;
  listResults(context: HttpRouterContext): Promise<ItemsDto<CompletedMatch>>;
  getStandings(context: HttpRouterContext): Promise<Standings>;
  listScorers(context: HttpRouterContext): Promise<ItemsDto<TopScorer>>;
}

/** A path id that is not a UUID names nothing, so it is answered as an unknown resource. */
export function idParam(context: HttpRouterContext, resource: "league" | "team" | "match"): string {
  const id = requireParam(context.params, "id");

  if (!isUuid(id)) throw new NotFoundError(resource, id.slice(0, 64));

  return id.toLowerCase();
}

export function createMatchController(queryBus: QueryBus): MatchController {
  return {
    listLeagues: async () => ({
      items: await queryBus.execute<ListLeaguesQuery, readonly League[]>(new ListLeaguesQuery()),
    }),

    listTeams: async (context) => {
      const query = parseQuery(context.query, listTeamsQueryValidator);

      return { items: await queryBus.execute<ListTeamsQuery, readonly TeamDto[]>(new ListTeamsQuery(query.leagueId)) };
    },

    listFixtures: async (context) => ({
      items: await queryBus.execute<ListFixturesQuery, readonly Fixture[]>(
        new ListFixturesQuery(parseQuery(context.query, listFixturesQueryValidator)),
      ),
    }),

    listMatches: async (context) => ({
      items: await queryBus.execute<ListMatchesQuery, readonly Match[]>(
        new ListMatchesQuery(parseQuery(context.query, listMatchesQueryValidator)),
      ),
    }),

    getMatch: async (context) => queryBus.execute<GetMatchQuery, Match>(new GetMatchQuery(idParam(context, "match"))),

    listMatchEvents: async (context) => ({
      items: await queryBus.execute<ListMatchEventsQuery, readonly MatchEvent[]>(
        new ListMatchEventsQuery(idParam(context, "match")),
      ),
    }),

    getMatchStats: async (context) =>
      queryBus.execute<GetMatchStatsQuery, MatchStats>(new GetMatchStatsQuery(idParam(context, "match"))),

    listResults: async (context) => {
      const query = parseQuery(context.query, listResultsQueryValidator);

      return {
        items: await queryBus.execute<ListResultsQuery, readonly CompletedMatch[]>(
          new ListResultsQuery({ leagueId: query.leagueId, limit: query.limit }),
        ),
      };
    },

    getStandings: async (context) => {
      const query = parseQuery(context.query, seasonQueryValidator);

      return queryBus.execute<GetStandingsQuery, Standings>(
        new GetStandingsQuery({ leagueId: idParam(context, "league"), season: query.season }),
      );
    },

    listScorers: async (context) => {
      const query = parseQuery(context.query, seasonQueryValidator);

      return {
        items: await queryBus.execute<ListScorersQuery, readonly TopScorer[]>(
          new ListScorersQuery({ leagueId: idParam(context, "league"), season: query.season, limit: query.limit }),
        ),
      };
    },
  };
}
