import { createContainer } from "@zudojs/container";
import type { Container } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import type { WalletSettings } from "../configs/index.js";
import {
  LOGGER_TOKEN,
  WALLET_REPOSITORY_TOKEN,
  WALLET_SETTINGS_TOKEN,
} from "../constants/index.js";
import type { WalletRepository } from "../interfaces/index.js";

export interface ContainerLoaderConfig {
  readonly wallets: WalletRepository;
  readonly settings: WalletSettings;
  readonly logger: Logger;
}

export function loadContainer(config: ContainerLoaderConfig): Container {
  const container = createContainer();

  container.registerValue(WALLET_REPOSITORY_TOKEN, config.wallets);
  container.registerValue(WALLET_SETTINGS_TOKEN, config.settings);
  container.registerValue(LOGGER_TOKEN, config.logger);

  return container.start();
}
