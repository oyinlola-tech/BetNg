import type { HttpRouterContext } from "@betng/service-kit";
import { parseQuery, requireParam } from "@betng/service-kit";
import type { Fixture, League, Match, Team } from "@betng/contracts";
import type { QueryBus } from "@zudojs/cqrs";
import {
  GetMatchQuery,
  ListFixturesQuery,
  ListLeaguesQuery,
  ListMatchesQuery,
  ListTeamsQuery,
} from "../services/match/queries/index.js";
import {
  listMatchesQueryValidator,
  listTeamsQueryValidator,
} from "../validators/index.js";

export interface MatchController {
  listLeagues(): Promise<{ readonly items: readonly League[] }>;
  listTeams(
    context: HttpRouterContext,
  ): Promise<{ readonly items: readonly Team[] }>;
  listFixtures(): Promise<{ readonly items: readonly Fixture[] }>;
  listMatches(
    context: HttpRouterContext,
  ): Promise<{ readonly items: readonly Match[] }>;
  getMatch(context: HttpRouterContext): Promise<Match>;
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
        items: await queryBus.execute<ListTeamsQuery, readonly Team[]>(
          new ListTeamsQuery(query.leagueId),
        ),
      };
    },

    listFixtures: async () => ({
      items: await queryBus.execute<ListFixturesQuery, readonly Fixture[]>(
        new ListFixturesQuery(),
      ),
    }),

    listMatches: async (context) => {
      const query = parseQuery(context.query, listMatchesQueryValidator);

      return {
        items: await queryBus.execute<ListMatchesQuery, readonly Match[]>(
          new ListMatchesQuery({
            ...(query.leagueId === undefined
              ? {}
              : { leagueId: query.leagueId }),
            ...(query.status === undefined ? {} : { status: query.status }),
          }),
        ),
      };
    },

    getMatch: async (context) =>
      queryBus.execute<GetMatchQuery, Match>(
        new GetMatchQuery(requireParam(context.params, "id")),
      ),
  };
}
