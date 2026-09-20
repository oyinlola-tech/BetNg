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

export interface GatewayApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  readonly onShutdown: readonly (() => Promise<void>)[];
}

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
