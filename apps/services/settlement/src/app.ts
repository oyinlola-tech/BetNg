/**
 * Assembles the settlement service.
 *
 * Settlement sits at the end of the platform's chain: a match completes,
 * the simulation has already produced a result, and only then are the bets
 * referencing it resolved. Nothing here can reach back up that chain, which
 * is what the separation in `docs/architecture.md` is protecting.
 */

import { createServiceLogger, createServiceServer } from "@betng/service-kit";
import type {
  DependencyProbe,
  Logger,
  ServiceConfig,
  ServiceServer,
} from "@betng/service-kit";
import { createSettlementController } from "./controllers/index.js";
import { createSettlementDatabase } from "./databases/index.js";
import { loadContainer, loadServices } from "./loaders/index.js";
import { createInMemorySettlementRepository } from "./repositories/index.js";
import { registerSettlementRoutes } from "./routes/index.js";

/** The assembled settlement service. */
export interface SettlementApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  /** Released on shutdown, in order, after the listener closes. */
  readonly onShutdown: readonly (() => Promise<void>)[];
}

/**
 * Builds the settlement service from its configuration.
 *
 * @param config - The configuration read from the environment.
 * @returns The HTTP server, its logger and the shutdown steps.
 */
export function createApp(config: ServiceConfig): SettlementApp {
  const logger = createServiceLogger(config);
  const settlements = createInMemorySettlementRepository();
  const container = loadContainer({ settlements, logger });

  const probes: DependencyProbe[] = [];
  const onShutdown: (() => Promise<void>)[] = [
    async () => container.dispose(),
  ];

  if (config.databaseUrl !== undefined) {
    const database = createSettlementDatabase(config.databaseUrl);
    probes.push(database.probe);
    onShutdown.unshift(async () => database.database.close());
  }

  const controller = createSettlementController(loadServices(container));

  const server = createServiceServer({
    config,
    logger,
    probes,
    routes: (router) => {
      registerSettlementRoutes(router, controller);
    },
  });

  return { server, logger, onShutdown };
}
