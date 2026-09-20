/**
 * The match application service.
 *
 * Resolves its dependencies from the ZudoJS container rather than taking
 * them as arguments, so a handler's collaborators are declared once, at
 * registration, and swapping the in-memory repository for the PostgreSQL
 * one is a change to the container and nothing else.
 *
 * The match service has no commands in this phase: nothing here changes
 * match state until the lifecycle transitions land, so a command bus would
 * claim a capability that does not exist.
 */

import type { Container } from "@zudojs/container";
import type { QueryBus } from "@zudojs/cqrs";
import { MATCH_QUERY, MATCH_REPOSITORY_TOKEN } from "../../constants/index.js";
import {
  GetMatchHandler,
  ListFixturesHandler,
  ListLeaguesHandler,
  ListMatchesHandler,
  ListTeamsHandler,
} from "./queries/index.js";

/** What the match service registration needs. */
export interface MatchServiceConfig {
  /** The container the handlers' dependencies are resolved from. */
  readonly container: Container;
  /** The query bus to register read handlers on. */
  readonly queryBus: QueryBus;
}

/**
 * Registers the match read handlers with the query bus.
 *
 * @param config - The container and the bus to register on.
 */
export function registerMatchService(config: MatchServiceConfig): void {
  const { container, queryBus } = config;

  const matches = container.resolve(MATCH_REPOSITORY_TOKEN);

  queryBus.register(MATCH_QUERY.LIST_LEAGUES, new ListLeaguesHandler(matches));
  queryBus.register(MATCH_QUERY.LIST_TEAMS, new ListTeamsHandler(matches));
  queryBus.register(
    MATCH_QUERY.LIST_FIXTURES,
    new ListFixturesHandler(matches),
  );
  queryBus.register(MATCH_QUERY.LIST_MATCHES, new ListMatchesHandler(matches));
  queryBus.register(MATCH_QUERY.GET_MATCH, new GetMatchHandler(matches));
}
