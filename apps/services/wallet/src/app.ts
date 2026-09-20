/**
 * Assembles the wallet service.
 *
 * The pieces are wired in dependency order: the event bus and repository,
 * the container that holds them, the CQRS buses the application service
 * registers on, the controller, and the HTTP server.
 *
 * `@betng/service-kit` supplies everything that must not differ between
 * BetNG services — the logger, the request pipeline, the error envelope and
 * the health endpoints.
 *
 * SIMULATED FUNDS ONLY.
 */

import { createServiceLogger, createServiceServer } from "@betng/service-kit";
import type {
  DependencyProbe,
  Logger,
  ServiceConfig,
  ServiceServer,
} from "@betng/service-kit";
import { createWalletController } from "./controllers/index.js";
import { createWalletDatabase } from "./databases/index.js";
import { loadContainer, loadEvents, loadServices } from "./loaders/index.js";
import { createInMemoryWalletRepository } from "./repositories/index.js";
import { registerWalletRoutes } from "./routes/index.js";

/** The assembled wallet service. */
export interface WalletApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  /** Released on shutdown, in order, after the listener closes. */
  readonly onShutdown: readonly (() => Promise<void>)[];
}

/**
 * Builds the wallet service from its configuration.
 *
 * @param config - The configuration read from the environment.
 * @returns The HTTP server, its logger and the shutdown steps.
 */
export function createApp(config: ServiceConfig): WalletApp {
  const logger = createServiceLogger(config);
  const wallets = createInMemoryWalletRepository();
  const events = loadEvents(logger);
  const container = loadContainer({ wallets, events, logger });

  const probes: DependencyProbe[] = [];
  const onShutdown: (() => Promise<void>)[] = [
    async () => {
      events.dispose();
      await container.dispose();
    },
  ];

  if (config.databaseUrl !== undefined) {
    const database = createWalletDatabase(config.databaseUrl);
    probes.push(database.probe);
    onShutdown.unshift(async () => database.pool.close());
  }

  const controller = createWalletController(loadServices(container));

  const server = createServiceServer({
    config,
    logger,
    probes,
    routes: (router) => {
      registerWalletRoutes(router, controller);
    },
  });

  return { server, logger, onShutdown };
}
