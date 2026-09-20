/**
 * Assembles the gateway.
 *
 * The gateway is the platform's front door: it owns the public API surface
 * and forwards each route to the service that owns the data. It holds no
 * domain state, so it has no repository, no CQRS buses and no database —
 * only clients, a route table and the shared request pipeline.
 */

import {
  createRedisConnection,
  createServiceLogger,
  createServiceServer,
} from "@betng/service-kit";
import type {
  Logger,
  RedisConnection,
  ServiceConfig,
  ServiceServer,
} from "@betng/service-kit";
import { loadClients, loadContainer, loadProbes } from "./loaders/index.js";
import { registerGatewayRoutes } from "./routes/index.js";

/** The assembled gateway. */
export interface GatewayApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  /** Released on shutdown, in order, after the listener closes. */
  readonly onShutdown: readonly (() => Promise<void>)[];
}

/**
 * Builds the gateway from its configuration.
 *
 * @param config - The configuration read from the environment.
 * @returns The HTTP server, its logger and the shutdown steps.
 */
export function createApp(config: ServiceConfig): GatewayApp {
  const logger = createServiceLogger(config);
  const clients = loadClients(config);
  const container = loadContainer({ clients, logger });

  const redis: RedisConnection | undefined =
    config.redisUrl === undefined
      ? undefined
      : createRedisConnection(config.redisUrl);

  const onShutdown: (() => Promise<void>)[] = [
    async () => container.dispose(),
  ];

  if (redis !== undefined) {
    onShutdown.unshift(async () => redis.close());
  }

  const server = createServiceServer({
    config,
    logger,
    probes: loadProbes({
      config,
      clients,
      ...(redis === undefined ? {} : { redis }),
    }),
    routes: (router) => {
      registerGatewayRoutes(router, clients);
    },
  });

  return { server, logger, onShutdown };
}
