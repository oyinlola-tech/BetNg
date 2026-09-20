/**
 * Match HTTP handlers.
 *
 * A controller is the translation layer and nothing else: it validates what
 * arrived, dispatches one query on the bus, and returns the value. No data
 * access and no domain rules live here, which is what keeps the read side
 * reusable by a caller that is not HTTP.
 */

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
} from "../queries/index.js";
import {
  listMatchesQueryValidator,
  listTeamsQueryValidator,
} from "../validators/index.js";

/** The handlers the match routes bind to. */
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

/**
 * Creates the match controller.
 *
 * @param queryBus - The bus the read handlers are registered on.
 * @returns Handlers ready to bind to routes.
 */
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
