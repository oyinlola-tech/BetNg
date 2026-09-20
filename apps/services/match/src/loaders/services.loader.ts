/**
 * Builds the CQRS buses and registers the application services on them.
 *
 * Wiring lives here rather than in `app.ts` so the bus composition is
 * visible in one place instead of spread across the handlers.
 */

import { createQueryBus } from "@zudojs/cqrs";
import type { QueryBus } from "@zudojs/cqrs";
import type { Container } from "@zudojs/container";
import { LOGGER_TOKEN } from "../constants/index.js";
import { registerMatchService } from "../services/index.js";

/**
 * Builds the query bus with every match read handler registered.
 *
 * @param container - The container the handlers' dependencies come from.
 * @returns The configured query bus.
 */
export function loadServices(container: Container): QueryBus {
  const queryBus = createQueryBus();

  registerMatchService({ container, queryBus });

  container.resolve(LOGGER_TOKEN).debug("Query handlers registered", {
    handlers: queryBus.size(),
  });

  return queryBus;
}
