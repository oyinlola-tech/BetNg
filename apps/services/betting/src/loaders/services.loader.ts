/**
 * Builds the CQRS buses and registers the application services on them.
 */

import { createCommandBus, createQueryBus } from "@zudojs/cqrs";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { Container } from "@zudojs/container";
import { LOGGER_TOKEN } from "../constants/index.js";
import { registerBettingService } from "../services/index.js";

/** The buses the betting controller dispatches through. */
export interface BettingBuses {
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
}

/**
 * Builds the command and query buses with every handler registered.
 *
 * @param container - The container the handlers' dependencies come from.
 * @returns The configured buses.
 */
export function loadServices(container: Container): BettingBuses {
  const commandBus = createCommandBus();
  const queryBus = createQueryBus();

  registerBettingService({ container, commandBus, queryBus });

  container.resolve(LOGGER_TOKEN).debug("CQRS handlers registered", {
    commands: commandBus.size(),
    queries: queryBus.size(),
  });

  return { commandBus, queryBus };
}
