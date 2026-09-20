/**
 * Builds the ZudoJS dependency-injection container.
 */

import { createContainer } from "@zudojs/container";
import type { Container } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import { CHANNEL_REGISTRY_TOKEN, LOGGER_TOKEN } from "../constants/index.js";
import type { ChannelRegistry } from "../interfaces/index.js";

/** What the container is built from. */
export interface ContainerLoaderConfig {
  readonly channels: ChannelRegistry;
  readonly logger: Logger;
}

/**
 * Registers the event service's singletons.
 *
 * @param config - The instances to register.
 * @returns The started container.
 */
export function loadContainer(config: ContainerLoaderConfig): Container {
  const container = createContainer();

  container.registerValue(CHANNEL_REGISTRY_TOKEN, config.channels);
  container.registerValue(LOGGER_TOKEN, config.logger);

  return container.start();
}
