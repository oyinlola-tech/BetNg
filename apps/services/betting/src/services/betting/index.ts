import type { Container } from "@zudojs/container";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import {
  BET_REPOSITORY_TOKEN,
  BETTING_COMMAND,
  BETTING_QUERY,
  CLOCK_TOKEN,
  IDENTITY_PEER_TOKEN,
  LOGGER_TOKEN,
  MARKET_READER_TOKEN,
  MATCH_LOCK_TOKEN,
  RISK_PEER_TOKEN,
  WALLET_PEER_TOKEN,
} from "../../constants/index.js";
import { ApplySettlementHandler, PlaceBetHandler } from "./commands/index.js";
import { GetBetHandler, ListBetsHandler } from "./queries/index.js";

export interface BettingServiceConfig {
  readonly container: Container;
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
}

export function registerBettingService(config: BettingServiceConfig): void {
  const { container, commandBus, queryBus } = config;

  const bets = container.resolve(BET_REPOSITORY_TOKEN);
  const logger = container.resolve(LOGGER_TOKEN);

  commandBus.register(
    BETTING_COMMAND.PLACE_BET,
    new PlaceBetHandler({
      bets,
      markets: container.resolve(MARKET_READER_TOKEN),
      lock: container.resolve(MATCH_LOCK_TOKEN),
      risk: container.resolve(RISK_PEER_TOKEN),
      wallet: container.resolve(WALLET_PEER_TOKEN),
      identity: container.resolve(IDENTITY_PEER_TOKEN),
      logger,
      now: container.resolve(CLOCK_TOKEN),
    }),
  );

  commandBus.register(
    BETTING_COMMAND.APPLY_SETTLEMENT,
    new ApplySettlementHandler(bets, logger),
  );

  queryBus.register(BETTING_QUERY.GET_BET, new GetBetHandler(bets));
  queryBus.register(BETTING_QUERY.LIST_BETS, new ListBetsHandler(bets));
}
