/**
 * Builds the ZudoJS dependency-injection container.
 */

import { createContainer } from "@zudojs/container";
import type { Container } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import {
  LOGGER_TOKEN,
  SETTLEMENT_REPOSITORY_TOKEN,
} from "../constants/index.js";
import type { SettlementRepository } from "../interfaces/index.js";

/** What the container is built from. */
export interface ContainerLoaderConfig {
  readonly settlements: SettlementRepository;
  readonly logger: Logger;
}

/**
 * Registers the settlement service's singletons.
 *
 * @param config - The instances to register.
 * @returns The started container.
 */
export function loadContainer(config: ContainerLoaderConfig): Container {
  const container = createContainer();

  container.registerValue(SETTLEMENT_REPOSITORY_TOKEN, config.settlements);
  container.registerValue(LOGGER_TOKEN, config.logger);

  return container.start();
}
