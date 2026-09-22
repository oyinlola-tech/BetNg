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
  createBetSignalPublisher,
  createIdentityPeer,
  createRedisMatchLock,
  createRiskPeer,
  createWalletPeer,
} from "./clients/index.js";
import { PLACEMENT_PEER_TIMEOUT_MS, STAKE_RETURN } from "./constants/index.js";
import {
  createBettingController,
  createTicketController,
} from "./controllers/index.js";
import { createBettingDatabase } from "./databases/index.js";
import type {
  BetRepository,
  BetSignalPublisher,
  IdentityPeer,
  MatchLock,
  RiskPeer,
  StakeReturnRepository,
  WalletPeer,
} from "./interfaces/index.js";
import { createStakeReturnJob } from "./jobs/index.js";
import type { StakeReturnJob } from "./jobs/index.js";
import { loadContainer, loadServices } from "./loaders/index.js";
import { createBettingRpcServer } from "./procedures/index.js";
import {
  createBetRepository,
  createMarketReader,
  createStakeReturnRepository,
} from "./repositories/index.js";
import { registerBettingRoutes } from "./routes/index.js";
import { StakeReturner } from "./services/betting/stakeReturner.js";

export interface BettingApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  readonly stakeReturns: StakeReturnJob;
  readonly onShutdown: readonly (() => Promise<void>)[];
}

export interface BettingAppOverrides {
  readonly risk?: RiskPeer;
  readonly wallet?: WalletPeer;
  readonly identity?: IdentityPeer;
  readonly signals?: BetSignalPublisher;
  readonly lock?: MatchLock;
  readonly now?: () => Date;
  readonly wrapRepository?: (repository: BetRepository) => BetRepository;
  readonly wrapStakeReturns?: (
    returns: StakeReturnRepository,
  ) => StakeReturnRepository;
  readonly startJobs?: boolean;
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
  const identityRpc = createRpcClient(config.services.identity, placementPeer);
  const eventRpc = createRpcClient(config.services.event);

  const repository = createBetRepository(database.prisma);
  const bets = overrides.wrapRepository?.(repository) ?? repository;
  const wallet = overrides.wallet ?? createWalletPeer(walletRpc);
  const now = overrides.now ?? (() => new Date());

  const returns = createStakeReturnRepository(database.prisma);
  const stakeReturner = new StakeReturner({
    returns: overrides.wrapStakeReturns?.(returns) ?? returns,
    bets,
    wallet,
    logger,
    now,
  });
  const stakeReturns = createStakeReturnJob({
    returner: stakeReturner,
    logger,
    intervalMs: STAKE_RETURN.intervalMs,
  });

  const container = loadContainer({
    bets,
    markets: createMarketReader(database.prisma),
    lock: overrides.lock ?? createRedisMatchLock(redis, logger),
    risk: overrides.risk ?? createRiskPeer(riskRpc),
    wallet,
    identity: overrides.identity ?? createIdentityPeer(identityRpc, logger),
    logger,
    now,
    stakeReturner,
    signals: overrides.signals ?? createBetSignalPublisher(eventRpc, logger),
  });

  const buses = loadServices(container);

  // Risk, the wallet and identity (limits.check) are required: without any of them no online bet can be accepted.
  const probes: DependencyProbe[] = [
    database.probe,
    redisProbe(redis),
    serviceProbe(createServiceClient(config.services.risk)),
    serviceProbe(createServiceClient(config.services.wallet)),
    serviceProbe(createServiceClient(config.services.identity)),
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
          now,
        }),
      );
    },
  });

  if (overrides.startJobs !== false) {
    stakeReturns.start();
  }

  const onShutdown: (() => Promise<void>)[] = [
    async () => stakeReturns.stop(),
    async () => database.database.close(),
    async () => redis.close(),
    async () => {
      await riskRpc.close();
      await walletRpc.close();
      await identityRpc.close();
      await container.dispose();
    },
  ];

  return { server, logger, stakeReturns, onShutdown };
}
