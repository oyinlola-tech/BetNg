/**
 * Builds the ZudoJS dependency-injection container.
 */

import { createContainer } from "@zudojs/container";
import type { Container } from "@zudojs/container";
import type { EventBus } from "@zudojs/events";
import type { Logger } from "@betng/service-kit";
import {
  BET_REPOSITORY_TOKEN,
  EVENT_BUS_TOKEN,
  LOGGER_TOKEN,
} from "../constants/index.js";
import type { BetRepository } from "../interfaces/index.js";

/** What the container is built from. */
export interface ContainerLoaderConfig {
  readonly bets: BetRepository;
  readonly events: EventBus;
  readonly logger: Logger;
}

/**
 * Registers the betting service's singletons.
 *
 * @param config - The instances to register.
 * @returns The started container.
 */
export function loadContainer(config: ContainerLoaderConfig): Container {
  const container = createContainer();

  container.registerValue(BET_REPOSITORY_TOKEN, config.bets);
  container.registerValue(EVENT_BUS_TOKEN, config.events);
  container.registerValue(LOGGER_TOKEN, config.logger);

  return container.start();
}
