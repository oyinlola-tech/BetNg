import { createCommandBus, createQueryBus } from "@zudojs/cqrs";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { Container } from "@zudojs/container";
import { LOGGER_TOKEN } from "../constants/index.js";
import {
  registerBettingService,
  registerTicketService,
} from "../services/index.js";

export interface BettingBuses {
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
}

export function loadServices(container: Container): BettingBuses {
  const commandBus = createCommandBus();
  const queryBus = createQueryBus();

  registerBettingService({ container, commandBus, queryBus });
  registerTicketService({ container, commandBus, queryBus });

  container.resolve(LOGGER_TOKEN).debug("CQRS handlers registered", {
    commands: commandBus.size(),
    queries: queryBus.size(),
  });

  return { commandBus, queryBus };
}
