/**
 * The match application service.
 *
 * Registers every match query handler on the query bus. The match service
 * has no commands in this phase: nothing here changes match state until the
 * lifecycle transitions land, so a command bus would claim a capability
 * that does not exist.
 */

import type { QueryBus } from "@zudojs/cqrs";
import { MATCH_QUERY } from "../../constants/index.js";
import type { MatchRepository } from "../../interfaces/index.js";
import {
  GetMatchHandler,
  ListFixturesHandler,
  ListLeaguesHandler,
  ListMatchesHandler,
  ListTeamsHandler,
} from "./queries/index.js";

/** What the match service registration needs. */
export interface MatchServiceConfig {
  /** The repository every handler reads through. */
  readonly matches: MatchRepository;
  /** The query bus to register read handlers on. */
  readonly queryBus: QueryBus;
}

/**
 * Registers the match read handlers with the query bus.
 *
 * @param config - The repository and the bus to register on.
 */
export function registerMatchService(config: MatchServiceConfig): void {
  const { matches, queryBus } = config;

  queryBus.registerMany([
    {
      queryType: MATCH_QUERY.LIST_LEAGUES,
      handler: new ListLeaguesHandler(matches),
    },
    {
      queryType: MATCH_QUERY.LIST_TEAMS,
      handler: new ListTeamsHandler(matches),
    },
    {
      queryType: MATCH_QUERY.LIST_FIXTURES,
      handler: new ListFixturesHandler(matches),
    },
    {
      queryType: MATCH_QUERY.LIST_MATCHES,
      handler: new ListMatchesHandler(matches),
    },
    {
      queryType: MATCH_QUERY.GET_MATCH,
      handler: new GetMatchHandler(matches),
    },
  ]);
}
