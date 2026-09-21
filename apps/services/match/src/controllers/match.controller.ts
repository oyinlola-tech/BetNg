import type {
  CompletedMatch,
  Fixture,
  HeadToHead,
  League,
  Match,
  MatchEvent,
  MatchLineups,
  MatchStats,
  SearchResponse,
  Standings,
  TopScorer,
} from "@betng/contracts";
import { getRequestId, parseQuery, requireParam } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import type { QueryBus } from "@zudojs/cqrs";
import type {
  ItemsDto,
  PageDto,
  PublicConfigDto,
  TeamDto,
} from "../dtos/index.js";
import { NotFoundError } from "../errors/index.js";
import {
  GetHeadToHeadQuery,
  GetMatchLineupsQuery,
  GetMatchQuery,
  GetMatchStatsQuery,
  GetPublicConfigQuery,
  GetStandingsQuery,
  ListFixturesQuery,
  ListLeaguesQuery,
  ListMatchEventsQuery,
  ListMatchesQuery,
  ListResultsQuery,
  ListScorersQuery,
  ListTeamsQuery,
  SearchQuery,
} from "../services/match/queries/index.js";
import {
  isUuid,
  listFixturesQueryValidator,
  listMatchesQueryValidator,
  listResultsQueryValidator,
  listTeamsQueryValidator,
  searchQueryValidator,
  seasonQueryValidator,
} from "../validators/index.js";

export interface MatchController {
  readonly listLeagues: () => Promise<ItemsDto<League>>;
  readonly listTeams: (
    context: HttpRouterContext,
  ) => Promise<ItemsDto<TeamDto>>;
  readonly listFixtures: (
    context: HttpRouterContext,
  ) => Promise<PageDto<Fixture>>;
  readonly listMatches: (context: HttpRouterContext) => Promise<PageDto<Match>>;
  readonly getMatch: (context: HttpRouterContext) => Promise<Match>;
  readonly listMatchEvents: (
    context: HttpRouterContext,
  ) => Promise<ItemsDto<MatchEvent>>;
  readonly getMatchStats: (context: HttpRouterContext) => Promise<MatchStats>;
  readonly getMatchLineups: (
    context: HttpRouterContext,
  ) => Promise<MatchLineups>;
  readonly getHeadToHead: (context: HttpRouterContext) => Promise<HeadToHead>;
  readonly search: (context: HttpRouterContext) => Promise<SearchResponse>;
  readonly getPublicConfig: () => Promise<PublicConfigDto>;
  readonly listResults: (
    context: HttpRouterContext,
  ) => Promise<ItemsDto<CompletedMatch>>;
  readonly getStandings: (context: HttpRouterContext) => Promise<Standings>;
  readonly listScorers: (
    context: HttpRouterContext,
  ) => Promise<ItemsDto<TopScorer>>;
}

export function idParam(
  context: HttpRouterContext,
  resource: "league" | "team" | "match",
): string {
  const id = requireParam(context.params, "id");

  if (!isUuid(id)) throw new NotFoundError(resource, id.slice(0, 64));

  return id.toLowerCase();
}

export function createMatchController(queryBus: QueryBus): MatchController {
  return {
    listLeagues: async () => ({
      items: await queryBus.execute<ListLeaguesQuery, readonly League[]>(
        new ListLeaguesQuery(),
      ),
    }),

    listTeams: async (context) => {
      const query = parseQuery(context.query, listTeamsQueryValidator);

      return {
        items: await queryBus.execute<ListTeamsQuery, readonly TeamDto[]>(
          new ListTeamsQuery(query.leagueId),
        ),
      };
    },

    listFixtures: async (context) =>
      queryBus.execute<ListFixturesQuery, PageDto<Fixture>>(
        new ListFixturesQuery(
          parseQuery(context.query, listFixturesQueryValidator),
        ),
      ),

    listMatches: async (context) =>
      queryBus.execute<ListMatchesQuery, PageDto<Match>>(
        new ListMatchesQuery(
          parseQuery(context.query, listMatchesQueryValidator),
        ),
      ),

    getMatch: async (context) =>
      queryBus.execute<GetMatchQuery, Match>(
        new GetMatchQuery(idParam(context, "match")),
      ),

    listMatchEvents: async (context) => ({
      items: await queryBus.execute<
        ListMatchEventsQuery,
        readonly MatchEvent[]
      >(new ListMatchEventsQuery(idParam(context, "match"))),
    }),

    getMatchStats: async (context) =>
      queryBus.execute<GetMatchStatsQuery, MatchStats>(
        new GetMatchStatsQuery(idParam(context, "match")),
      ),

    getMatchLineups: async (context) =>
      queryBus.execute<GetMatchLineupsQuery, MatchLineups>(
        new GetMatchLineupsQuery(
          idParam(context, "match"),
          getRequestId(context.request),
        ),
      ),

    getHeadToHead: async (context) =>
      queryBus.execute<GetHeadToHeadQuery, HeadToHead>(
        new GetHeadToHeadQuery(idParam(context, "match")),
      ),

    search: async (context) =>
      queryBus.execute<SearchQuery, SearchResponse>(
        new SearchQuery(parseQuery(context.query, searchQueryValidator)),
      ),

    getPublicConfig: async () =>
      queryBus.execute<GetPublicConfigQuery, PublicConfigDto>(
        new GetPublicConfigQuery(),
      ),

    listResults: async (context) => {
      const query = parseQuery(context.query, listResultsQueryValidator);

      return {
        items: await queryBus.execute<
          ListResultsQuery,
          readonly CompletedMatch[]
        >(
          new ListResultsQuery({
            leagueId: query.leagueId,
            limit: query.limit,
          }),
        ),
      };
    },

    getStandings: async (context) => {
      const query = parseQuery(context.query, seasonQueryValidator);

      return queryBus.execute<GetStandingsQuery, Standings>(
        new GetStandingsQuery({
          leagueId: idParam(context, "league"),
          season: query.season,
        }),
      );
    },

    listScorers: async (context) => {
      const query = parseQuery(context.query, seasonQueryValidator);

      return {
        items: await queryBus.execute<ListScorersQuery, readonly TopScorer[]>(
          new ListScorersQuery({
            leagueId: idParam(context, "league"),
            season: query.season,
            limit: query.limit,
          }),
        ),
      };
    },
  };
}
