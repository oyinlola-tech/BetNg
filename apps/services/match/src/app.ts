import {
  createRedisConnection,
  createServiceClient,
  createServiceLogger,
  createServiceServer,
  redisProbe,
  serviceProbe,
} from "@betng/service-kit";
import type { DependencyProbe, Logger, RedisConnection, ServiceServer } from "@betng/service-kit";
import { createPeers } from "./clients/index.js";
import type { MatchConfig } from "./configs/index.js";
import { createAdminController, createMatchController } from "./controllers/index.js";
import { createMatchDatabase } from "./databases/index.js";
import type { Clock, Peers } from "./interfaces/index.js";
import { createSchedulerJob } from "./jobs/index.js";
import type { SchedulerJob } from "./jobs/index.js";
import { loadContainer, loadServices } from "./loaders/index.js";
import {
  createBettingReader,
  createCatalogueRepository,
  createLifecycleRepository,
  createMatchRepository,
  createSimulationReader,
} from "./repositories/index.js";
import { registerAdminRoutes, registerMatchRoutes } from "./routes/index.js";
import { seedCatalogue } from "./seeds/index.js";
import { createLifecycleService } from "./services/index.js";
import type { LifecycleService } from "./services/index.js";

export interface MatchApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  readonly onShutdown: readonly (() => Promise<void>)[];
  readonly lifecycle: LifecycleService;
  readonly scheduler: SchedulerJob;
  /** Seeds an empty catalogue, then starts the scheduler when it is enabled. */
  readonly startBackground: () => Promise<void>;
}

export interface MatchAppOverrides {
  readonly peers?: Peers;
  readonly clock?: Clock;
  readonly redis?: RedisConnection;
}

const PEER_NAMES = ["odds", "simulation", "risk", "settlement", "event", "identity"] as const;

export function createApp(config: MatchConfig, overrides: MatchAppOverrides = {}): MatchApp {
  if (config.databaseUrl === undefined || config.redisUrl === undefined) {
    throw new Error("The match service needs MATCH_DATABASE_URL and REDIS_URL.");
  }

  const logger = createServiceLogger(config);
  const database = createMatchDatabase(config.databaseUrl);
  const redis = overrides.redis ?? createRedisConnection(config.redisUrl);
  const rpcPeers = overrides.peers === undefined ? createPeers(config.services) : undefined;
  const peers = overrides.peers ?? rpcPeers;
  const clock = overrides.clock ?? (() => new Date());

  if (peers === undefined) throw new Error("No peers were configured.");

  const catalogue = createCatalogueRepository(database.prisma);
  const matches = createMatchRepository(database.prisma);
  const simulation = createSimulationReader(database.prisma);

  const lifecycle = createLifecycleService({
    catalogue,
    matches,
    lifecycle: createLifecycleRepository(database.prisma),
    simulation,
    betting: createBettingReader(database.prisma),
    peers,
    timing: config.timing,
    clock,
    logger,
  });

  const scheduler = createSchedulerJob({ redis, tick: async () => lifecycle.tick(), logger });

  const container = loadContainer({
    catalogue,
    matches,
    simulation,
    lifecycle,
    identity: peers.identity,
    timing: config.timing,
    clock,
    logger,
  });

  const probes: DependencyProbe[] = [
    database.probe,
    redisProbe(redis),
    ...PEER_NAMES.map((name) => serviceProbe(createServiceClient(config.services[name]), { optional: true })),
  ];

  const { queryBus, commandBus } = loadServices(container);
  const controller = createMatchController(queryBus);
  const adminController = createAdminController(queryBus, commandBus);

  const server = createServiceServer({
    config,
    logger,
    probes,
    routes: (router) => {
      registerMatchRoutes(router, controller);
      registerAdminRoutes(router, adminController);
    },
  });

  return {
    server,
    logger,
    lifecycle,
    scheduler,
    startBackground: async () => {
      await seedCatalogue(database.prisma, logger);

      if (config.schedulerEnabled) {
        scheduler.start();
      } else {
        logger.info("Scheduler disabled by SCHEDULER_ENABLED=false", { event: "match.schedulerDisabled" });
      }
    },
    // The scheduler stops first, so no tick is left calling a peer or the database while they close.
    onShutdown: [
      async () => scheduler.stop(),
      async () => rpcPeers?.close(),
      async () => redis.close(),
      async () => database.database.close(),
      async () => container.dispose(),
    ],
  };
}
