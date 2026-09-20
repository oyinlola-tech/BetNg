import type { Container } from "@zudojs/container";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import {
  BET_REPOSITORY_TOKEN,
  BETTING_COMMAND,
  BETTING_QUERY,
  EVENT_BUS_TOKEN,
  RISK_GATE_TOKEN,
} from "../../constants/index.js";
import { PlaceBetHandler } from "./commands/index.js";
import { GetBetHandler, ListBetsHandler } from "./queries/index.js";

export interface BettingServiceConfig {
  readonly container: Container;
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
}

export function registerBettingService(config: BettingServiceConfig): void {
  const { container, commandBus, queryBus } = config;

  const bets = container.resolve(BET_REPOSITORY_TOKEN);
  const events = container.resolve(EVENT_BUS_TOKEN);
  const risk = container.resolve(RISK_GATE_TOKEN);

  commandBus.register(
    BETTING_COMMAND.PLACE_BET,
    new PlaceBetHandler(bets, events, risk),
  );

  queryBus.register(BETTING_QUERY.GET_BET, new GetBetHandler(bets));
  queryBus.register(BETTING_QUERY.LIST_BETS, new ListBetsHandler(bets));
}
