import { createContainer } from "@zudojs/container";
import type { Container } from "@zudojs/container";
import { HANDLER_DEPENDENCIES_TOKEN, LOGGER_TOKEN } from "../constants/index.js";
import type { HandlerDependencies } from "../interfaces/index.js";

export function loadContainer(dependencies: HandlerDependencies): Container {
  const container = createContainer();

  container.registerValue(HANDLER_DEPENDENCIES_TOKEN, dependencies);
  container.registerValue(LOGGER_TOKEN, dependencies.logger);

  return container.start();
}
