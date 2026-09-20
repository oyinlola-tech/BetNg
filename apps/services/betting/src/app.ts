/**
 * Assembles the betting service.
 *
 * `@betng/service-kit` supplies everything that must not differ between
 * BetNG services — the logger, the request pipeline, the error envelope and
 * the health endpoints — so this file contains only what is specific to the
 * betting service.
 */

import { createServiceLogger, createServiceServer } from "@betng/service-kit";
import type {
  DependencyProbe,
  Logger,
  ServiceConfig,
  ServiceServer,
} from "@betng/service-kit";
import { createBettingController } from "./controllers/index.js";
import { createBettingDatabase } from "./databases/index.js";
import { loadServices } from "./loaders/index.js";
import { createInMemoryBetRepository } from "./repositories/index.js";
import { registerBettingRoutes } from "./routes/index.js";

/** The assembled betting service. */
export interface BettingApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  /** Released on shutdown, in order, after the listener closes. */
  readonly onShutdown: readonly (() => Promise<void>)[];
}

/**
 * Builds the betting service from its configuration.
 *
 * @param config - The configuration read from the environment.
 * @returns The HTTP server, its logger and the shutdown steps.
 */
export function createApp(config: ServiceConfig): BettingApp {
  const logger = createServiceLogger(config);
  const bets = createInMemoryBetRepository();

  const probes: DependencyProbe[] = [];
  const onShutdown: (() => Promise<void>)[] = [];

  if (config.databaseUrl !== undefined) {
    const database = createBettingDatabase(config.databaseUrl);
    probes.push(database.probe);
    onShutdown.push(async () => database.pool.close());
  }

  const controller = createBettingController(loadServices({ bets, logger }));

  const server = createServiceServer({
    config,
    logger,
    probes,
    routes: (router) => {
      registerBettingRoutes(router, controller);
    },
  });

  return { server, logger, onShutdown };
}
