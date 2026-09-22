import { createRedisConnection, createServiceLogger, createServiceServer, redisProbe } from "@betng/service-kit";
import type { Logger, RedisConnection, ServiceServer } from "@betng/service-kit";
import type { IdentityConfig } from "./configs/index.js";
import { DEFAULT_PLATFORM_SETTINGS, SYSTEM_ACTOR } from "./constants/index.js";
import {
  createAccountController,
  createAdminController,
  createChannelsController,
  createComplianceController,
  createCustomerAuthController,
  createKycController,
  createLimitsController,
  createNotificationController,
  createShopController,
} from "./controllers/index.js";
import { createIdentityDatabase } from "./databases/index.js";
import type { HandlerDependencies } from "./interfaces/index.js";
import { startComplianceJob, startMaintenanceJob } from "./jobs/index.js";
import { loadContainer, loadServices } from "./loaders/index.js";
import { createIdentityRpcServer } from "./procedures/index.js";
import { createIdentityStore, createReadModelRepository } from "./repositories/index.js";
import {
  registerAccountRoutes,
  registerAdminRoutes,
  registerChannelRoutes,
  registerComplianceRoutes,
  registerCustomerAuthRoutes,
  registerKycRoutes,
  registerLimitRoutes,
  registerNotificationRoutes,
  registerShopRoutes,
} from "./routes/index.js";
import { runDemoSeed } from "./seeds/index.js";
import { createEmailProvider, createMessenger, createPushProvider, createSmsProvider } from "./services/delivery/index.js";
import { createDocumentStorage, createIdentityVerificationProvider } from "./services/kyc/index.js";
import {
  createAuditWriter,
  createBreachChecker,
  createLoginThrottle,
  createPasswordHasher,
  createRealtimeRevoker,
  createSessionCacheEvictor,
  createSessionIssuer,
  createSessionResolver,
  createVerificationIssuer,
} from "./services/security/index.js";
import { createDataProtector } from "./utils/index.js";

export interface IdentityApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  readonly dependencies: HandlerDependencies;
  readonly onShutdown: readonly (() => Promise<void>)[];
  readonly prepare: () => Promise<void>;
}

export function createApp(config: IdentityConfig): IdentityApp {
  const logger = createServiceLogger(config.service);

  if (config.service.databaseUrl === undefined) {
    throw new Error("IDENTITY_DATABASE_URL is required.");
  }

  const { database, probe, prisma } = createIdentityDatabase(config.service.databaseUrl);
  const redis: RedisConnection | undefined =
    config.service.redisUrl === undefined ? undefined : createRedisConnection(config.service.redisUrl);
  const store = createIdentityStore(prisma);
  const hasher = createPasswordHasher();
  const protector = createDataProtector(config.dataKey);
  const { delivery } = config;
  const realtime = createRealtimeRevoker(config.service.services.event);

  const messenger = createMessenger({
    providers: {
      email: createEmailProvider(delivery.email, delivery.timeoutMs, logger),
      sms: createSmsProvider(delivery.sms, delivery.timeoutMs, logger),
      push: createPushProvider(delivery.push, delivery.timeoutMs, logger),
    },
    store,
    protector,
    logger,
  });

  const dependencies: HandlerDependencies = {
    store,
    readModel: createReadModelRepository(prisma, logger),
    hasher,
    sessions: createSessionIssuer(config.security),
    resolver: createSessionResolver(store),
    throttle: createLoginThrottle(store.throttles),
    audit: createAuditWriter(),
    verifications: createVerificationIssuer(config.security, messenger, logger),
    security: config.security,
    logger,
    protector,
    messenger,
    evictor: createSessionCacheEvictor(store, redis, realtime, logger),
    breachChecker: createBreachChecker(config.security.passwordBreachCheck, logger),
    storage: config.kyc.storage === undefined ? undefined : createDocumentStorage(config.kyc.storage),
    identityVerifier: createIdentityVerificationProvider(config.kyc.identityProvider),
    kyc: config.kyc,
  };

  if (redis === undefined) {
    logger.warn("REDIS_URL is not set: revoked sessions cannot be evicted from a gateway actor cache", {
      event: "gateway_cache_eviction_disabled",
    });
  }

  const container = loadContainer(dependencies);
  const buses = loadServices(container);
  const maintenance = startMaintenanceJob(store, logger);
  const compliance = startComplianceJob(dependencies);

  const server = createServiceServer({
    config: config.service,
    logger,
    probes: redis === undefined ? [probe] : [probe, redisProbe(redis)],
    rpcServer: createIdentityRpcServer(buses.commandBus, buses.queryBus, logger),
    routes: (router) => {
      registerCustomerAuthRoutes(router, createCustomerAuthController(buses));
      registerShopRoutes(router, createShopController(buses));
      registerNotificationRoutes(router, createNotificationController(buses));
      registerAdminRoutes(router, createAdminController(buses));
      registerAccountRoutes(router, createAccountController(buses));
      registerChannelRoutes(router, createChannelsController(buses));
      registerKycRoutes(router, createKycController(buses));
      registerLimitRoutes(router, createLimitsController(buses));
      registerComplianceRoutes(router, createComplianceController(buses));
    },
  });

  return {
    server,
    logger,
    dependencies,
    onShutdown: [
      async () => {
        maintenance.stop();
        compliance.stop();
        await container.dispose();
        await redis?.close();
        await realtime.close();
        await database.close();
      },
    ],
    prepare: async () => {
      await store.settings.createIfMissing(DEFAULT_PLATFORM_SETTINGS, SYSTEM_ACTOR.id);
      await runDemoSeed({ config, store, hasher, logger });
    },
  };
}
