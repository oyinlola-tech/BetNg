import {
  createServiceClient,
  createServiceLogger,
  createServiceServer,
  serviceProbe,
} from "@betng/service-kit";
import type { Logger, ServiceServer } from "@betng/service-kit";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import {
  createAuditRecorder,
  createBettingClient,
  createIdentityClient,
  createWalletClient,
} from "./clients/index.js";
import type { SettlementConfig } from "./configs/index.js";
import {
  createCommissionController,
  createOperatorController,
  createSettlementController,
} from "./controllers/index.js";
import { createSettlementDatabase } from "./databases/index.js";
import type { BettingPeer, IdentityPeer, WalletPeer } from "./interfaces/index.js";
import { createMaintenanceJob } from "./jobs/index.js";
import type { MaintenanceJob } from "./jobs/index.js";
import { loadContainer, loadServices } from "./loaders/index.js";
import { createSettlementRpcServer } from "./procedures/index.js";
import {
  createCommissionRepository,
  createOperatorRepository,
  createPlatformReader,
  createSettlementRepository,
} from "./repositories/index.js";
import { registerSettlementRoutes } from "./routes/index.js";

export interface SettlementPeers {
  readonly betting: BettingPeer;
  readonly wallet: WalletPeer;
  readonly identity: IdentityPeer;
}

export interface SettlementApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
  readonly maintenance: MaintenanceJob;
  readonly prepare: () => Promise<void>;
  readonly onShutdown: readonly (() => Promise<void>)[];
}

export function createApp(config: SettlementConfig, peers?: SettlementPeers): SettlementApp {
  if (config.databaseUrl === undefined) {
    throw new Error("SETTLEMENT_DATABASE_URL is required.");
  }

  const logger = createServiceLogger(config);
  const database = createSettlementDatabase(config.databaseUrl);
  const onShutdown: (() => Promise<void>)[] = [];

  let resolved = peers;

  if (resolved === undefined) {
    const betting = createBettingClient(config.services.betting);
    const wallet = createWalletClient(config.services.wallet);
    const identity = createIdentityClient(config.services.identity);

    resolved = { betting, wallet, identity };
    onShutdown.push(async () => {
      await Promise.all([betting.raw.close(), wallet.raw.close(), identity.raw.close()]);
    });
  }

  const commission = createCommissionRepository(database.prisma);
  const operator = createOperatorRepository(database.prisma);

  const container = loadContainer({
    settlements: createSettlementRepository(database.prisma),
    operator,
    commission,
    platform: createPlatformReader(database.prisma),
    betting: resolved.betting,
    wallet: resolved.wallet,
    audit: createAuditRecorder(resolved.identity, logger),
    logger,
  });

  const { commandBus, queryBus } = loadServices(container);

  const maintenance = createMaintenanceJob({
    commandBus,
    logger,
    intervalMs: config.settlement.retryIntervalMs,
  });

  const server = createServiceServer({
    config,
    logger,
    probes: [
      database.probe,
      serviceProbe(createServiceClient(config.services.betting)),
      serviceProbe(createServiceClient(config.services.wallet)),
      serviceProbe(createServiceClient(config.services.identity), { optional: true }),
    ],
    rpcServer: createSettlementRpcServer(commandBus),
    routes: (router) => {
      registerSettlementRoutes(router, {
        settlement: createSettlementController(commandBus, queryBus),
        operator: createOperatorController(commandBus, queryBus),
        commission: createCommissionController(commandBus, queryBus),
      });
    },
  });

  onShutdown.unshift(async () => maintenance.stop());
  onShutdown.push(
    async () => container.dispose(),
    async () => database.database.close(),
  );

  return {
    server,
    logger,
    commandBus,
    queryBus,
    maintenance,
    onShutdown,

    prepare: async () => {
      if (await commission.seedDefault(config.settlement.defaultShopShareBasisPoints)) {
        logger.info("Default commission configuration seeded");
      }

      await operator.ensureOpenPeriod(new Date());

      if (config.settlement.retryEnabled) {
        maintenance.start();
      }
    },
  };
}
