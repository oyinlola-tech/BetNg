/**
 * Builds the ZudoJS dependency-injection container.
 */

import { createContainer } from "@zudojs/container";
import type { Container } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import { LOGGER_TOKEN, UPSTREAM_CLIENTS_TOKEN } from "../constants/index.js";
import type { UpstreamClients } from "../interfaces/index.js";

/** What the container is built from. */
export interface ContainerLoaderConfig {
  readonly clients: UpstreamClients;
  readonly logger: Logger;
}

/**
 * Registers the gateway's singletons.
 *
 * @param config - The instances to register.
 * @returns The started container.
 */
export function loadContainer(config: ContainerLoaderConfig): Container {
  const container = createContainer();

  container.registerValue(UPSTREAM_CLIENTS_TOKEN, config.clients);
  container.registerValue(LOGGER_TOKEN, config.logger);

  return container.start();
}
