import {
  createErrorHandler,
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
import { createActorResolver, createRateLimiter } from "./clients/index.js";
import { loadGatewaySettings, SERVICE_VERSION } from "./configs/index.js";
import type { GatewaySettings } from "./configs/index.js";
import { loadClients, loadContainer, loadProbes } from "./loaders/index.js";
import {
  createCorsMiddleware,
  createSecurityHeadersMiddleware,
} from "./middlewares/index.js";
import { buildRouteTable, registerGatewayRoutes } from "./routes/index.js";

export interface GatewayApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  readonly onShutdown: readonly (() => Promise<void>)[];
}

export function createApp(
  config: ServiceConfig,
  settings: GatewaySettings = loadGatewaySettings(),
): GatewayApp {
  const logger = createServiceLogger(config);
  const clients = loadClients(config);
  const container = loadContainer({ clients, logger });

  const redis: RedisConnection | undefined =
    config.redisUrl === undefined
      ? undefined
      : createRedisConnection(config.redisUrl);

  const actors = createActorResolver({
    identity: config.services.identity,
    cacheSeconds: settings.actorCacheSeconds,
    logger,
    ...(redis === undefined ? {} : { redis }),
  });

  const onShutdown: (() => Promise<void>)[] = [
    async () => actors.close(),
    async () => container.dispose(),
  ];

  if (redis !== undefined) {
    onShutdown.push(async () => redis.close());
  }

  const server = createServiceServer({
    config,
    logger,
    probes: loadProbes({ clients, ...(redis === undefined ? {} : { redis }) }),
    middlewares: [
      { name: "security-headers", middleware: createSecurityHeadersMiddleware() },
      {
        name: "cors",
        middleware: createCorsMiddleware(settings.corsOrigins, createErrorHandler(logger)),
      },
    ],
    routes: (router) => {
      registerGatewayRoutes(router, {
        table: buildRouteTable(settings.loginRateLimit),
        version: SERVICE_VERSION,
        clients,
        actors,
        limiter: createRateLimiter(redis, logger),
      });
    },
  });

  return { server, logger, onShutdown };
}
