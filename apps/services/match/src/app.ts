/**
 * Assembles the match service.
 *
 * The pieces are wired in dependency order: the repository the handlers
 * read through, the query bus they register on, the controller that
 * dispatches to it, and the HTTP server that binds the routes.
 *
 * `@betng/service-kit` supplies everything that must not differ between
 * BetNG services — the logger, the request pipeline, the error envelope and
 * the health endpoints — so this file contains only what is specific to the
 * match service.
 */

import { createServiceLogger, createServiceServer } from "@betng/service-kit";
import type {
  DependencyProbe,
  Logger,
  ServiceConfig,
  ServiceServer,
} from "@betng/service-kit";
import { createMatchController } from "./controllers/index.js";
import { createMatchDatabase } from "./databases/index.js";
import { loadContainer, loadServices } from "./loaders/index.js";
import { createInMemoryMatchRepository } from "./repositories/index.js";
import { registerMatchRoutes } from "./routes/index.js";

/** The assembled match service. */
export interface MatchApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  /** Released on shutdown, in order, after the listener closes. */
  readonly onShutdown: readonly (() => Promise<void>)[];
}

/**
 * Builds the match service from its configuration.
 *
 * @param config - The configuration read from the environment.
 * @returns The HTTP server, its logger and the shutdown steps.
 */
export function createApp(config: ServiceConfig): MatchApp {
  const logger = createServiceLogger(config);
  const matches = createInMemoryMatchRepository();

  const container = loadContainer({ matches, logger });

  const probes: DependencyProbe[] = [];
  const onShutdown: (() => Promise<void>)[] = [
    async () => container.dispose(),
  ];

  if (config.databaseUrl !== undefined) {
    const database = createMatchDatabase(config.databaseUrl);
    probes.push(database.probe);
    onShutdown.unshift(async () => database.pool.close());
  }

  const controller = createMatchController(loadServices(container));

  const server = createServiceServer({
    config,
    logger,
    probes,
    routes: (router) => {
      registerMatchRoutes(router, controller);
    },
  });

  return { server, logger, onShutdown };
}
