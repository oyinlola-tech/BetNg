/**
 * Builds the CQRS buses and registers the application services on them.
 *
 * Wiring lives here rather than in `app.ts` so the bus composition is
 * visible in one place instead of spread across the handlers.
 */

import { createQueryBus } from "@zudojs/cqrs";
import type { QueryBus } from "@zudojs/cqrs";
import type { Logger } from "@betng/service-kit";
import type { MatchRepository } from "../interfaces/index.js";
import { registerMatchService } from "../services/index.js";

/** What the service loader needs to build the buses. */
export interface ServiceLoaderConfig {
  readonly matches: MatchRepository;
  readonly logger: Logger;
}

/**
 * Builds the query bus with every match read handler registered.
 *
 * @param config - The repository the handlers read through, and a logger.
 * @returns The configured query bus.
 */
export function loadServices(config: ServiceLoaderConfig): QueryBus {
  const queryBus = createQueryBus();

  registerMatchService({ matches: config.matches, queryBus });

  config.logger.debug("Query handlers registered", {
    handlers: queryBus.size(),
  });

  return queryBus;
}
