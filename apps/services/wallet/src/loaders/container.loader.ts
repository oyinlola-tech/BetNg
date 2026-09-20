import { createContainer } from "@zudojs/container";
import type { Container } from "@zudojs/container";
import type { EventBus } from "@zudojs/events";
import type { Logger } from "@betng/service-kit";
import {
  EVENT_BUS_TOKEN,
  LOGGER_TOKEN,
  WALLET_REPOSITORY_TOKEN,
} from "../constants/index.js";
import type { WalletRepository } from "../interfaces/index.js";

export interface ContainerLoaderConfig {
  readonly wallets: WalletRepository;
  readonly events: EventBus;
  readonly logger: Logger;
}

export function loadContainer(config: ContainerLoaderConfig): Container {
  const container = createContainer();

  container.registerValue(WALLET_REPOSITORY_TOKEN, config.wallets);
  container.registerValue(EVENT_BUS_TOKEN, config.events);
  container.registerValue(LOGGER_TOKEN, config.logger);

  return container.start();
}
