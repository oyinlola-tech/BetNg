import { createToken } from "@zudojs/container";
import type { Logger } from "@betng/service-kit";
import type { HandlerDependencies } from "../interfaces/index.js";

export const HANDLER_DEPENDENCIES_TOKEN =
  createToken<HandlerDependencies>("identity.handlerDependencies");

export const LOGGER_TOKEN = createToken<Logger>("identity.logger");
