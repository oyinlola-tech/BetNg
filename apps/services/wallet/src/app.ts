import { createRpcClient, createServiceLogger, createServiceServer } from "@betng/service-kit";
import type {
  Logger,
  ServiceConfig,
  ServiceServer,
} from "@betng/service-kit";
import { createSignalPublisher } from "./clients/event.client.js";
import type { SignalPublisher } from "./clients/event.client.js";
import { createIdentityPeer } from "./clients/identity.client.js";
import type { IdentityPeer } from "./clients/identity.client.js";
import { loadWalletSettings } from "./configs/index.js";
import type { WalletSettings } from "./configs/index.js";
import { createPaymentsController, createWalletController } from "./controllers/index.js";
import { createWalletDatabase } from "./databases/index.js";
import { createWalletJobs } from "./jobs/index.js";
import type { WalletJobs } from "./jobs/index.js";
import { loadContainer, loadServices } from "./loaders/index.js";
import { createWalletRpcServer } from "./procedures/index.js";
import { createProviderRegistry } from "./providers/index.js";
import {
  createBankAccountsRepository,
  createPaymentsRepository,
  createShiftsRepository,
  createStatementsRepository,
  createWalletRepository,
} from "./repositories/index.js";
import { registerPaymentRoutes, registerWalletRoutes } from "./routes/index.js";
import { createFieldCipher } from "./security/crypto.js";
import { BankAccountsService } from "./services/payments/bankAccounts.service.js";
import { PaymentsService } from "./services/payments/payments.service.js";
import { ShiftsService } from "./services/shifts/shifts.service.js";
import { StatementsService } from "./services/statements/statements.service.js";
import { createS3Storage } from "./storage/s3.storage.js";

export interface WalletApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  readonly jobs: WalletJobs;
  readonly payments: PaymentsService;
  readonly statements: StatementsService;
  readonly onShutdown: readonly (() => Promise<void>)[];
}

/** Test seams: stubs in place of the identity and event RPC clients. */
export interface WalletAppOverrides {
  readonly identity?: IdentityPeer;
  readonly signals?: SignalPublisher;
}

export function createApp(
  config: ServiceConfig,
  settings: WalletSettings = loadWalletSettings(),
  overrides: WalletAppOverrides = {},
): WalletApp {
  if (config.databaseUrl === undefined) {
    throw new Error("WALLET_DATABASE_URL is not set: the wallet is its ledger.");
  }

  const logger = createServiceLogger(config);
  const { database, probe, prisma } = createWalletDatabase(config.databaseUrl);
  const wallets = createWalletRepository(prisma, settings, logger);
  const container = loadContainer({ wallets, settings, logger });
  const buses = loadServices(container);

  const identityRpc = overrides.identity === undefined ? createRpcClient(config.services.identity) : undefined;
  const identity = overrides.identity ?? createIdentityPeer(identityRpc ?? createRpcClient(config.services.identity), logger);
  const eventRpc = overrides.signals === undefined ? createRpcClient(config.services.event, { timeoutMs: 2_000 }) : undefined;
  const signals = overrides.signals ?? createSignalPublisher(eventRpc ?? createRpcClient(config.services.event), logger);
  const cipher = settings.payments.encryptionKey === undefined ? undefined : createFieldCipher(settings.payments.encryptionKey);
  const registry = createProviderRegistry(settings.payments);
  const bankAccounts = createBankAccountsRepository(prisma);

  const payments = new PaymentsService({
    settings: settings.payments,
    registry,
    payments: createPaymentsRepository(prisma, logger),
    bankAccounts,
    wallets,
    identity,
    signals,
    cipher,
    logger,
  });
  const statements = new StatementsService({
    statements: createStatementsRepository(prisma),
    storage: settings.payments.storage === undefined ? undefined : createS3Storage(settings.payments.storage),
    logger,
  });
  const shifts = new ShiftsService({ shifts: createShiftsRepository(prisma), wallets, identity, signals });
  const jobs = createWalletJobs({ payments, statements, logger, intervalMs: settings.payments.jobsIntervalMs });

  const controller = createWalletController({
    ...buses,
    settings,
    pendingWithdrawals: async (userId) => payments.pendingWithdrawals(userId),
  });
  const paymentsController = createPaymentsController({
    payments,
    bankAccounts: new BankAccountsService({ registry, bankAccounts, cipher }),
    statements,
    shifts,
  });
  const rpcServer = createWalletRpcServer(buses);

  const server = createServiceServer({
    config,
    logger,
    probes: [probe],
    rpcServer,
    routes: (router) => {
      registerWalletRoutes(router, controller);
      registerPaymentRoutes(router, paymentsController);
    },
  });

  if (settings.payments.jobsEnabled) {
    jobs.start();
  }

  logger.info("Payments configured", {
    provider: settings.payments.activeProvider ?? "none",
    statements: settings.payments.storage === undefined ? "storage not configured" : "storage configured",
    bankAccounts: cipher === undefined ? "encryption key not configured" : "encryption key configured",
  });

  return {
    server,
    logger,
    jobs,
    payments,
    statements,
    onShutdown: [
      () => {
        jobs.stop();

        return Promise.resolve();
      },
      async () => identityRpc?.close(),
      async () => eventRpc?.close(),
      async () => database.close(),
      async () => container.dispose(),
    ],
  };
}
