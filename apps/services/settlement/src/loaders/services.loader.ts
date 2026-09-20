/**
 * Builds the CQRS buses and registers the application services on them.
 */

import { createQueryBus } from "@zudojs/cqrs";
import type { QueryBus } from "@zudojs/cqrs";
import type { Container } from "@zudojs/container";
import { LOGGER_TOKEN } from "../constants/index.js";
import { registerSettlementService } from "../services/index.js";

/**
 * Builds the query bus with every settlement read handler registered.
 *
 * @param container - The container the handlers' dependencies come from.
 * @returns The configured query bus.
 */
export function loadServices(container: Container): QueryBus {
  const queryBus = createQueryBus();

  registerSettlementService({ container, queryBus });

  container.resolve(LOGGER_TOKEN).debug("Query handlers registered", {
    handlers: queryBus.size(),
  });

  return queryBus;
}
