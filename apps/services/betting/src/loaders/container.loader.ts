import { createContainer } from "@zudojs/container";
import type { Container } from "@zudojs/container";
import type { EventBus } from "@zudojs/events";
import type { Logger } from "@betng/service-kit";
import {
  BET_REPOSITORY_TOKEN,
  EVENT_BUS_TOKEN,
  LOGGER_TOKEN,
  RISK_GATE_TOKEN,
} from "../constants/index.js";
import type { BetRepository, RiskGate } from "../interfaces/index.js";

export interface ContainerLoaderConfig {
  readonly bets: BetRepository;
  readonly events: EventBus;
  readonly risk: RiskGate;
  readonly logger: Logger;
}

export function loadContainer(config: ContainerLoaderConfig): Container {
  const container = createContainer();

  container.registerValue(BET_REPOSITORY_TOKEN, config.bets);
  container.registerValue(EVENT_BUS_TOKEN, config.events);
  container.registerValue(RISK_GATE_TOKEN, config.risk);
  container.registerValue(LOGGER_TOKEN, config.logger);

  return container.start();
}
