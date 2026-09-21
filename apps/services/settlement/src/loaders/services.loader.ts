import { createCommandBus, createQueryBus } from "@zudojs/cqrs";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { Container } from "@zudojs/container";
import { LOGGER_TOKEN } from "../constants/index.js";
import {
  registerCommissionService,
  registerOperatorService,
  registerSettlementService,
} from "../services/index.js";

export interface ServiceBuses {
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
}

export function loadServices(container: Container): ServiceBuses {
  const commandBus = createCommandBus();
  const queryBus = createQueryBus();

  registerSettlementService({ container, commandBus, queryBus });
  registerOperatorService({ container, commandBus, queryBus });
  registerCommissionService({ container, commandBus, queryBus });

  container.resolve(LOGGER_TOKEN).debug("Handlers registered", {
    commands: commandBus.size(),
    queries: queryBus.size(),
  });

  return { commandBus, queryBus };
}
