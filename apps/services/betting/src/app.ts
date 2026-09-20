/**
 * Assembles the betting service.
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
import { createBetControllers } from "./controllers/betController.js";
import { BettingModule } from "./modules/index.js";
import { createInMemoryBetRepository } from "./repositories/betRepository.js";
import { registerBettingRoutes } from "./routes/index.js";

export interface BettingApp {
  readonly runtime: Runtime;
  readonly server: ServiceServer;
  readonly logger: Logger;
  readonly onShutdown: readonly (() => Promise<void>)[];
}

export async function createApp(config: ServiceConfig): Promise<BettingApp> {
  const logger = createServiceLogger(config);
  const repository = createInMemoryBetRepository();

  const modules = new Map<string, Module>();
  const bettingModule = new BettingModule(repository);
  modules.set(bettingModule.id, bettingModule);

  const runtime = createRuntime(
    { modules, logger, container: createContainer(), eventBus: createEventBus() },
    {
      applicationName: `betng-${config.serviceName}`,
      applicationVersion: SERVICE_VERSION,
      environment: resolveEnvironment(),
      handleSignals: false,
    },
  );

  await runtime.start();

  const probes: DependencyProbe[] = [];
  const onShutdown: (() => Promise<void>)[] = [() => runtime.stop()];

  if (config.databaseUrl !== undefined) {
    const postgres = createPostgresPool(config.databaseUrl);
    probes.push(postgresProbe(postgres));
    onShutdown.unshift(() => postgres.close());
  }

  const controllers = createBetControllers(repository);

  const server = createServiceServer({
    config,
    logger,
    probes,
    routes: (router) => {
      registerBettingRoutes(router, controllers);
    },
  });

  return { runtime, server, logger, onShutdown };
}
