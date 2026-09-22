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
import { createActorResolver, createIpBlocklist, createRateLimiter } from "./clients/index.js";
import { GATEWAY_HARD_BODY_CAP, loadGatewaySettings, SERVICE_VERSION } from "./configs/index.js";
import type { GatewaySettings } from "./configs/index.js";
import { loadClients, loadContainer, loadProbes } from "./loaders/index.js";
import {
  createCorsMiddleware,
  createGlobalRateLimitMiddleware,
  createIpBlockMiddleware,
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
  const renderError = createErrorHandler(logger);

  if (config.environment === "production" && config.redisUrl === undefined) {
    throw new Error("REDIS_URL is required in production: rate limits, the blocklist and the session cache live there.");
  }

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

  const limiter = createRateLimiter(redis, logger, { prefix: settings.redisPrefix });
  const blocklist = createIpBlocklist({
    entries: settings.ipBlocklist,
    prefix: settings.redisPrefix,
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
    maxBodyBytes: GATEWAY_HARD_BODY_CAP,
    trustProxy: settings.trustProxy,
    probes: loadProbes({ clients, ...(redis === undefined ? {} : { redis }) }),
    middlewares: [
      { name: "security-headers", middleware: createSecurityHeadersMiddleware({ hsts: settings.hsts }) },
      { name: "ip-blocklist", middleware: createIpBlockMiddleware(blocklist, renderError) },
      { name: "cors", middleware: createCorsMiddleware(settings.corsOrigins, renderError) },
      { name: "global-rate-limit", middleware: createGlobalRateLimitMiddleware(limiter, settings.rateLimits.global) },
    ],
    routes: (router) => {
      registerGatewayRoutes(router, {
        table: buildRouteTable(settings.rateLimits),
        version: SERVICE_VERSION,
        clients,
        actors,
        limiter,
        bodyLimits: {
          maxBodyBytes: settings.maxBodyBytes,
          webhookMaxBodyBytes: settings.webhookMaxBodyBytes,
        },
        healthLimit: settings.rateLimits.health,
      });
    },
  });

  return { server, logger, onShutdown };
}
