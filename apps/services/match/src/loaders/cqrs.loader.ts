/**
 * Registers the match service's CQRS handlers.
 *
 * Wiring lives here rather than in `app.ts` so adding a query is one import
 * and one registration in one file, and so the bus composition is visible in
 * one place instead of spread across the handlers.
 */

import { createQueryBus } from "@zudojs/cqrs";
import type { QueryBus } from "@zudojs/cqrs";
import type { Logger } from "@betng/service-kit";
import { MATCH_QUERY } from "../constants/index.js";
import type { MatchRepository } from "../interfaces/index.js";
import {
  GetMatchHandler,
  ListFixturesHandler,
  ListLeaguesHandler,
  ListMatchesHandler,
  ListTeamsHandler,
} from "../queries/index.js";

/** What the CQRS loader needs to build the buses. */
export interface CqrsLoaderOptions {
  readonly repository: MatchRepository;
  readonly logger: Logger;
}

/**
 * Builds the query bus with every match read handler registered.
 *
 * The match service has no command bus in this phase: nothing here changes
 * match state yet. One is added when the match lifecycle transitions land,
 * rather than registered empty now.
 *
 * @param options - The repository the handlers read through, and a logger.
 * @returns The configured query bus.
 */
export function loadCqrs(options: CqrsLoaderOptions): QueryBus {
  const { repository, logger } = options;

  const queryBus = createQueryBus();

  queryBus.registerMany([
    {
      queryType: MATCH_QUERY.LIST_LEAGUES,
      handler: new ListLeaguesHandler(repository),
    },
    { queryType: MATCH_QUERY.LIST_TEAMS, handler: new ListTeamsHandler(repository) },
    {
      queryType: MATCH_QUERY.LIST_FIXTURES,
      handler: new ListFixturesHandler(repository),
    },
    {
      queryType: MATCH_QUERY.LIST_MATCHES,
      handler: new ListMatchesHandler(repository),
    },
    { queryType: MATCH_QUERY.GET_MATCH, handler: new GetMatchHandler(repository) },
  ]);

  logger.debug("Query handlers registered", { handlers: queryBus.size() });

  return queryBus;
}
