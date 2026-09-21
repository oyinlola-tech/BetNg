import { createServiceLogger, createServiceServer } from "@betng/service-kit";
import type {
  Logger,
  ServiceConfig,
  ServiceServer,
} from "@betng/service-kit";
import { loadWalletSettings } from "./configs/index.js";
import type { WalletSettings } from "./configs/index.js";
import { createWalletController } from "./controllers/index.js";
import { createWalletDatabase } from "./databases/index.js";
import { loadContainer, loadServices } from "./loaders/index.js";
import { createWalletRpcServer } from "./procedures/index.js";
import { createWalletRepository } from "./repositories/index.js";
import { registerWalletRoutes } from "./routes/index.js";

export interface WalletApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  readonly onShutdown: readonly (() => Promise<void>)[];
}

export function createApp(
  config: ServiceConfig,
  settings: WalletSettings = loadWalletSettings(),
): WalletApp {
  if (config.databaseUrl === undefined) {
    throw new Error("WALLET_DATABASE_URL is not set: the wallet is its ledger.");
  }

  const logger = createServiceLogger(config);
  const { database, probe, prisma } = createWalletDatabase(config.databaseUrl);
  const wallets = createWalletRepository(prisma, settings, logger);
  const container = loadContainer({ wallets, settings, logger });
  const buses = loadServices(container);

  const controller = createWalletController({ ...buses, settings });
  const rpcServer = createWalletRpcServer(buses);

  const server = createServiceServer({
    config,
    logger,
    probes: [probe],
    rpcServer,
    routes: (router) => {
      registerWalletRoutes(router, controller);
    },
  });

  return {
    server,
    logger,
    onShutdown: [
      async () => database.close(),
      async () => container.dispose(),
    ],
  };
}
