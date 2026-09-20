/**
 * The betting application service.
 *
 * Registers every betting command and query handler on the buses, so the
 * composition of the betting domain is visible in one place.
 */

import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import { BETTING_COMMAND, BETTING_QUERY } from "../../constants/index.js";
import type { BetRepository } from "../../interfaces/index.js";
import { PlaceBetHandler } from "./commands/index.js";
import { GetBetHandler, ListBetsHandler } from "./queries/index.js";

/** What the betting service registration needs. */
export interface BettingServiceConfig {
  /** The repository every handler works through. */
  readonly bets: BetRepository;
  /** The command bus to register write handlers on. */
  readonly commandBus: CommandBus;
  /** The query bus to register read handlers on. */
  readonly queryBus: QueryBus;
}

/**
 * Registers the betting handlers with their buses.
 *
 * @param config - The repository and the buses to register on.
 */
export function registerBettingService(config: BettingServiceConfig): void {
  const { bets, commandBus, queryBus } = config;

  commandBus.register(BETTING_COMMAND.PLACE_BET, new PlaceBetHandler(bets));

  queryBus.registerMany([
    { queryType: BETTING_QUERY.GET_BET, handler: new GetBetHandler(bets) },
    { queryType: BETTING_QUERY.LIST_BETS, handler: new ListBetsHandler(bets) },
  ]);
}
