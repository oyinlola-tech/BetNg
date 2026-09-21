import {
  createRedisConnection,
  createRpcClient,
  createServiceClient,
  createServiceLogger,
  createServiceServer,
  redisProbe,
  serviceProbe,
} from "@betng/service-kit";
import type {
  DependencyProbe,
  Logger,
  ServiceConfig,
  ServiceServer,
} from "@betng/service-kit";
import {
  createIdentityPeer,
  createRedisMatchLock,
  createRiskPeer,
  createWalletPeer,
} from "./clients/index.js";
import { PLACEMENT_PEER_TIMEOUT_MS } from "./constants/index.js";
import {
  createBettingController,
  createTicketController,
} from "./controllers/index.js";
import { createBettingDatabase } from "./databases/index.js";
import type {
  BetRepository,
  IdentityPeer,
  MatchLock,
  RiskPeer,
  WalletPeer,
} from "./interfaces/index.js";
import { loadContainer, loadServices } from "./loaders/index.js";
import { createBettingRpcServer } from "./procedures/index.js";
import { createBetRepository, createMarketReader } from "./repositories/index.js";
import { registerBettingRoutes } from "./routes/index.js";

export interface BettingApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  readonly onShutdown: readonly (() => Promise<void>)[];
}

/** Substitutes for the network-facing collaborators, for tests. */
export interface BettingAppOverrides {
  readonly risk?: RiskPeer;
  readonly wallet?: WalletPeer;
  readonly identity?: IdentityPeer;
  readonly lock?: MatchLock;
  readonly now?: () => Date;
  readonly wrapRepository?: (repository: BetRepository) => BetRepository;
}

export function createApp(
  config: ServiceConfig,
  overrides: BettingAppOverrides = {},
): BettingApp {
  if (config.databaseUrl === undefined || config.redisUrl === undefined) {
    throw new Error("BETTING_DATABASE_URL and REDIS_URL are required.");
  }

  const logger = createServiceLogger(config);
  const database = createBettingDatabase(config.databaseUrl);
  const redis = createRedisConnection(config.redisUrl);

  const placementPeer = { timeoutMs: PLACEMENT_PEER_TIMEOUT_MS };
  const riskRpc = createRpcClient(config.services.risk, placementPeer);
  const walletRpc = createRpcClient(config.services.wallet, placementPeer);
  const identityRpc = createRpcClient(config.services.identity);

  const repository = createBetRepository(database.prisma);

  const container = loadContainer({
    bets: overrides.wrapRepository?.(repository) ?? repository,
    markets: createMarketReader(database.prisma),
    lock: overrides.lock ?? createRedisMatchLock(redis, logger),
    risk: overrides.risk ?? createRiskPeer(riskRpc),
    wallet: overrides.wallet ?? createWalletPeer(walletRpc),
    identity: overrides.identity ?? createIdentityPeer(identityRpc, logger),
    logger,
    now: overrides.now ?? (() => new Date()),
  });

  const buses = loadServices(container);

  // Risk and the wallet are required: without either, no bet can be accepted.
  const probes: DependencyProbe[] = [
    database.probe,
    redisProbe(redis),
    serviceProbe(createServiceClient(config.services.risk)),
    serviceProbe(createServiceClient(config.services.wallet)),
    serviceProbe(createServiceClient(config.services.identity), {
      optional: true,
    }),
  ];

  const server = createServiceServer({
    config,
    logger,
    probes,
    rpcServer: createBettingRpcServer(buses.commandBus),
    routes: (router) => {
      registerBettingRoutes(
        router,
        createBettingController(buses),
        createTicketController({
          ...buses,
          now: overrides.now ?? (() => new Date()),
        }),
      );
    },
  });

  const onShutdown: (() => Promise<void>)[] = [
    async () => database.database.close(),
    async () => redis.close(),
    async () => {
      await riskRpc.close();
      await walletRpc.close();
      await identityRpc.close();
      await container.dispose();
    },
  ];

  return { server, logger, onShutdown };
}
