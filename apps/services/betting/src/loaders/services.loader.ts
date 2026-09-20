/**
 * Builds the CQRS buses and registers the application services on them.
 */

import { createCommandBus, createQueryBus } from "@zudojs/cqrs";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { Logger } from "@betng/service-kit";
import type { BetRepository } from "../interfaces/index.js";
import { registerBettingService } from "../services/index.js";

/** What the service loader needs to build the buses. */
export interface ServiceLoaderConfig {
  readonly bets: BetRepository;
  readonly logger: Logger;
}

/** The buses the betting controller dispatches through. */
export interface BettingBuses {
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
}

/**
 * Builds the command and query buses with every handler registered.
 *
 * @param config - The repository the handlers use, and a logger.
 * @returns The configured buses.
 */
export function loadServices(config: ServiceLoaderConfig): BettingBuses {
  const commandBus = createCommandBus();
  const queryBus = createQueryBus();

  registerBettingService({ bets: config.bets, commandBus, queryBus });

  config.logger.debug("CQRS handlers registered", {
    commands: commandBus.size(),
    queries: queryBus.size(),
  });

  return { commandBus, queryBus };
}
