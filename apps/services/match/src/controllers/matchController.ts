/**
 * Match HTTP handlers.
 *
 * Handlers translate between HTTP and the repository: they validate what
 * came in, call the repository, and hand back a value. They throw the
 * `HttpError` helpers rather than building an error body, so the service
 * kit's error handler renders one envelope for the whole platform.
 */

import { match as matchContracts } from "@betng/contracts";
import {
  notFound,
  parseQuery,
  requireParam,
  type HttpRouterContext,
} from "@betng/service-kit";
import type { MatchRepository } from "../repositories/matchRepository.js";

export interface MatchControllers {
  listLeagues: (context: HttpRouterContext) => Promise<unknown>;
  listTeams: (context: HttpRouterContext) => Promise<unknown>;
  listFixtures: (context: HttpRouterContext) => Promise<unknown>;
  listMatches: (context: HttpRouterContext) => Promise<unknown>;
  getMatch: (context: HttpRouterContext) => Promise<unknown>;
}

const listTeamsQuerySchema = matchContracts.listMatchesQuerySchema.pick({
  leagueId: true,
});

export function createMatchControllers(
  repository: MatchRepository,
): MatchControllers {
  return {
    listLeagues: async () => ({ items: await repository.listLeagues() }),

    listTeams: async (context) => {
      const query = parseQuery(context.query, listTeamsQuerySchema);
      return { items: await repository.listTeams(query.leagueId) };
    },

    listFixtures: async () => ({ items: await repository.listFixtures() }),

    listMatches: async (context) => {
      const query = parseQuery(
        context.query,
        matchContracts.listMatchesQuerySchema,
      );
      return {
        items: await repository.listMatches({
          ...(query.leagueId === undefined ? {} : { leagueId: query.leagueId }),
          ...(query.status === undefined ? {} : { status: query.status }),
        }),
      };
    },

    getMatch: async (context) => {
      const id = requireParam(context.params, "id");
      const found = await repository.findMatch(id);

      if (found === undefined) {
        throw notFound(`No match with id ${id}.`);
      }

      return found;
    },
  };
}
