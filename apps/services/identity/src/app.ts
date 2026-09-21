import { createServiceLogger, createServiceServer } from "@betng/service-kit";
import type { Logger, ServiceServer } from "@betng/service-kit";
import type { IdentityConfig } from "./configs/index.js";
import { DEFAULT_PLATFORM_SETTINGS, SYSTEM_ACTOR } from "./constants/index.js";
import {
  createAdminController,
  createCustomerAuthController,
  createNotificationController,
  createShopController,
} from "./controllers/index.js";
import { createIdentityDatabase } from "./databases/index.js";
import type { HandlerDependencies } from "./interfaces/index.js";
import { startMaintenanceJob } from "./jobs/index.js";
import { loadContainer, loadServices } from "./loaders/index.js";
import { createIdentityRpcServer } from "./procedures/index.js";
import { createIdentityStore, createReadModelRepository } from "./repositories/index.js";
import {
  registerAdminRoutes,
  registerCustomerAuthRoutes,
  registerNotificationRoutes,
  registerShopRoutes,
} from "./routes/index.js";
import { runDemoSeed } from "./seeds/index.js";
import {
  createAuditWriter,
  createLoginThrottle,
  createPasswordHasher,
  createSessionIssuer,
  createSessionResolver,
  createVerificationIssuer,
} from "./services/security/index.js";

export interface IdentityApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  readonly onShutdown: readonly (() => Promise<void>)[];
  readonly prepare: () => Promise<void>;
}

export function createApp(config: IdentityConfig): IdentityApp {
  const logger = createServiceLogger(config.service);

  if (config.service.databaseUrl === undefined) {
    throw new Error("IDENTITY_DATABASE_URL is required.");
  }

  const { database, probe, prisma } = createIdentityDatabase(config.service.databaseUrl);
  const store = createIdentityStore(prisma);
  const hasher = createPasswordHasher();

  const dependencies: HandlerDependencies = {
    store,
    readModel: createReadModelRepository(prisma, logger),
    hasher,
    sessions: createSessionIssuer(config.security),
    resolver: createSessionResolver(store),
    throttle: createLoginThrottle(store.throttles),
    audit: createAuditWriter(),
    verifications: createVerificationIssuer(config.security, logger),
    security: config.security,
    logger,
  };

  const container = loadContainer(dependencies);
  const buses = loadServices(container);
  const maintenance = startMaintenanceJob(store, logger);

  const server = createServiceServer({
    config: config.service,
    logger,
    probes: [probe],
    rpcServer: createIdentityRpcServer(buses.commandBus, logger),
    routes: (router) => {
      registerCustomerAuthRoutes(router, createCustomerAuthController(buses));
      registerShopRoutes(router, createShopController(buses));
      registerNotificationRoutes(router, createNotificationController(buses));
      registerAdminRoutes(router, createAdminController(buses));
    },
  });

  return {
    server,
    logger,
    onShutdown: [
      async () => {
        maintenance.stop();
        await container.dispose();
        await database.close();
      },
    ],
    prepare: async () => {
      await store.settings.createIfMissing(DEFAULT_PLATFORM_SETTINGS, SYSTEM_ACTOR.id);
      await runDemoSeed({ config, store, hasher, logger });
    },
  };
}
