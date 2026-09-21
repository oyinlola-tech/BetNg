import { createContainer } from "@zudojs/container";
import type { Container } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import {
  BET_REPOSITORY_TOKEN,
  CLOCK_TOKEN,
  IDENTITY_PEER_TOKEN,
  LOGGER_TOKEN,
  MARKET_READER_TOKEN,
  MATCH_LOCK_TOKEN,
  RISK_PEER_TOKEN,
  WALLET_PEER_TOKEN,
} from "../constants/index.js";
import type {
  BetRepository,
  IdentityPeer,
  MarketReader,
  MatchLock,
  RiskPeer,
  WalletPeer,
} from "../interfaces/index.js";

export interface ContainerLoaderConfig {
  readonly bets: BetRepository;
  readonly markets: MarketReader;
  readonly lock: MatchLock;
  readonly risk: RiskPeer;
  readonly wallet: WalletPeer;
  readonly identity: IdentityPeer;
  readonly logger: Logger;
  readonly now: () => Date;
}

export function loadContainer(config: ContainerLoaderConfig): Container {
  const container = createContainer();

  container.registerValue(BET_REPOSITORY_TOKEN, config.bets);
  container.registerValue(MARKET_READER_TOKEN, config.markets);
  container.registerValue(MATCH_LOCK_TOKEN, config.lock);
  container.registerValue(RISK_PEER_TOKEN, config.risk);
  container.registerValue(WALLET_PEER_TOKEN, config.wallet);
  container.registerValue(IDENTITY_PEER_TOKEN, config.identity);
  container.registerValue(LOGGER_TOKEN, config.logger);
  container.registerValue(CLOCK_TOKEN, config.now);

  return container.start();
}
