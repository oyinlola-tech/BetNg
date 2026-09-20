/**
 * Assembles the match service.
 *
 * Two things are built here and handed back together:
 *
 *   - the ZudoJS **runtime**, which owns the module lifecycle, the
 *     dependency-injection container and the event bus, and
 *   - the **HTTP server**, built by `@betng/service-kit` from this service's
 *     routes and dependency probes.
 *
 * They are separate on purpose. The runtime is where things with an
 * application-long lifetime live; HTTP is one way of reaching them. A worker
 * process would start the same runtime with no server at all.
 */

import { resolveEnvironment } from "@zudojs/constants";
import { createContainer } from "@zudojs/container";
import { createEventBus } from "@zudojs/events";
import { createRuntime } from "@zudojs/runtime";
import type { Runtime } from "@zudojs/runtime";
import { createServiceLogger, createServiceServer } from "@betng/service-kit";
import type {
  DependencyProbe,
  Logger,
  ServiceConfig,
  ServiceServer,
} from "@betng/service-kit";
import { SERVICE_VERSION } from "./configs/index.js";
import { createMatchController } from "./controllers/index.js";
import { createMatchDatabase } from "./databases/index.js";
import { loadCqrs, loadModules } from "./loaders/index.js";
import { createInMemoryMatchRepository } from "./repositories/index.js";
import { registerMatchRoutes } from "./routes/index.js";

/** The assembled match service. */
export interface MatchApp {
  readonly runtime: Runtime;
  readonly server: ServiceServer;
  readonly logger: Logger;
  /** Released on shutdown, in order, after the listener closes. */
  readonly onShutdown: readonly (() => Promise<void>)[];
}

/**
 * Builds the match service from its configuration.
 *
 * @param config - The configuration read from the environment.
 * @returns The runtime, the HTTP server and the shutdown steps.
 */
export async function createApp(config: ServiceConfig): Promise<MatchApp> {
  const logger = createServiceLogger(config);
  const repository = createInMemoryMatchRepository();

  const runtime = createRuntime(
    {
      modules: loadModules(repository),
      logger,
      container: createContainer(),
      eventBus: createEventBus(),
    },
    {
      applicationName: `betng-${config.serviceName}`,
      applicationVersion: SERVICE_VERSION,
      environment: resolveEnvironment(),
      handleSignals: false,
    },
  );

  await runtime.start();

  const probes: DependencyProbe[] = [];
  const onShutdown: (() => Promise<void>)[] = [async () => runtime.stop()];

  if (config.databaseUrl !== undefined) {
    const database = createMatchDatabase(config.databaseUrl);
    probes.push(database.probe);
    onShutdown.unshift(async () => database.pool.close());
  }

  const queryBus = loadCqrs({ repository, logger });
  const controller = createMatchController(queryBus);

  const server = createServiceServer({
    config,
    logger,
    probes,
    routes: (router) => {
      registerMatchRoutes(router, controller);
    },
  });

  return { runtime, server, logger, onShutdown };
}
