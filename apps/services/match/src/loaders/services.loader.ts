import { createCommandBus, createQueryBus } from "@zudojs/cqrs";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { Container } from "@zudojs/container";
import { LOGGER_TOKEN } from "../constants/index.js";
import { registerMatchService } from "../services/index.js";

export interface ServiceBuses {
  readonly queryBus: QueryBus;
  readonly commandBus: CommandBus;
}

export function loadServices(container: Container): ServiceBuses {
  const queryBus = createQueryBus();
  const commandBus = createCommandBus();

  registerMatchService({ container, queryBus, commandBus });

  container.resolve(LOGGER_TOKEN).debug("Handlers registered", {
    queries: queryBus.size(),
    commands: commandBus.size(),
  });

  return { queryBus, commandBus };
}
