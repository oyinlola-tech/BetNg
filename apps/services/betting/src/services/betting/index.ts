/**
 * The betting application service.
 *
 * Resolves its dependencies from the ZudoJS container, so the composition
 * of the betting domain is declared once, at registration.
 */

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

/** What the betting service registration needs. */
export interface BettingServiceConfig {
  /** The container the handlers' dependencies are resolved from. */
  readonly container: Container;
  /** The command bus to register write handlers on. */
  readonly commandBus: CommandBus;
  /** The query bus to register read handlers on. */
  readonly queryBus: QueryBus;
}

/**
 * Registers the betting handlers with their buses.
 *
 * @param config - The container and the buses to register on.
 */
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
