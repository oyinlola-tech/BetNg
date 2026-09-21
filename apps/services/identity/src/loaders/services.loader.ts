import { createCommandBus, createQueryBus } from "@zudojs/cqrs";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { Container } from "@zudojs/container";
import { HANDLER_DEPENDENCIES_TOKEN, LOGGER_TOKEN } from "../constants/index.js";
import { registerIdentityServices } from "../services/index.js";

export interface IdentityBuses {
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
}

export function loadServices(container: Container): IdentityBuses {
  const commandBus = createCommandBus();
  const queryBus = createQueryBus();

  registerIdentityServices({
    dependencies: container.resolve(HANDLER_DEPENDENCIES_TOKEN),
    commandBus,
    queryBus,
  });

  container.resolve(LOGGER_TOKEN).debug("CQRS handlers registered", {
    commands: commandBus.size(),
    queries: queryBus.size(),
  });

  return { commandBus, queryBus };
}
