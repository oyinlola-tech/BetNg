/**
 * Assembles the match service.
 *
 * Two things are built here and handed back together:
 *
 *   - the ZudoJS **runtime**, which owns the module lifecycle, the DI
 *     container and the event bus, and
 *   - the **HTTP server**, built by `@betng/service-kit` from this service's
 *     routes and dependency probes.
 *
 * They are separate on purpose: the runtime is where things with an
 * application-long lifetime live, and the HTTP server is one way of reaching
 * them. A worker process would start the same runtime with no server at all.
 */

import { createContainer } from "@zudojs/container";
import { resolveEnvironment } from "@zudojs/constants";
import type { Module } from "@zudojs/core";
import { createEventBus } from "@zudojs/events";
import { createRuntime, type Runtime } from "@zudojs/runtime";
import {
  createPostgresPool,
  createServiceLogger,
  createServiceServer,
  postgresProbe,
  type DependencyProbe,
  type Logger,
  type ServiceConfig,
  type ServiceServer,
} from "@betng/service-kit";

import { SERVICE_VERSION } from "./config/index.js";
import { createMatchControllers } from "./controllers/matchController.js";
import { MatchModule } from "./modules/index.js";
import { createInMemoryMatchRepository } from "./repositories/matchRepository.js";
import { registerMatchRoutes } from "./routes/index.js";

export interface MatchApp {
  readonly runtime: Runtime;
  readonly server: ServiceServer;
  readonly logger: Logger;
  /** Released on shutdown, after the listener closes. */
  readonly onShutdown: readonly (() => Promise<void>)[];
}

export async function createApp(config: ServiceConfig): Promise<MatchApp> {
  const logger = createServiceLogger(config);
  const repository = createInMemoryMatchRepository();

  const modules = new Map<string, Module>();
  const matchModule = new MatchModule(repository);
  modules.set(matchModule.id, matchModule);

  const runtime = createRuntime(
    { modules, logger, container: createContainer(), eventBus: createEventBus() },
    {
      applicationName: `betng-${config.serviceName}`,
      applicationVersion: SERVICE_VERSION,
      environment: resolveEnvironment(),
      // The service kit installs its own signal handling in runService.
      handleSignals: false,
    },
  );

  await runtime.start();

  const probes: DependencyProbe[] = [];
  const onShutdown: (() => Promise<void>)[] = [() => runtime.stop()];

  // The database is probed only because this service owns one. A service
  // with no database reports no database, rather than an invented "ok".
  if (config.databaseUrl !== undefined) {
    const postgres = createPostgresPool(config.databaseUrl);
    probes.push(postgresProbe(postgres));
    onShutdown.unshift(() => postgres.close());
  }

  const controllers = createMatchControllers(repository);

  const server = createServiceServer({
    config,
    logger,
    probes,
    routes: (router) => {
      registerMatchRoutes(router, controllers);
    },
  });

  return { runtime, server, logger, onShutdown };
}
