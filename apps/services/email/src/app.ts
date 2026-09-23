import { createServiceLogger, createServiceServer } from "@betng/service-kit";
import type { Logger, ServiceServer } from "@betng/service-kit";
import type { EmailConfig } from "./configs/index.js";
import { createEmailController } from "./controllers/index.js";
import { createEmailDatabase } from "./databases/index.js";
import { createEmailRpcServer } from "./procedures/index.js";
import { createProvider } from "./providers/index.js";
import type { EmailProvider } from "./providers/index.js";
import { createEmailRepository } from "./repositories/index.js";
import { registerEmailRoutes } from "./routes/index.js";
import { DeliveryService } from "./services/index.js";

export interface EmailPeers {
  /** Injected by tests so a suite never reaches the real provider. */
  readonly provider?: EmailProvider;
}

export interface EmailApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  readonly delivery: DeliveryService;
  readonly prepare: () => Promise<void>;
  readonly onShutdown: readonly (() => Promise<void>)[];
}

export function createApp(config: EmailConfig, peers?: EmailPeers): EmailApp {
  if (config.databaseUrl === undefined) {
    throw new Error("EMAIL_DATABASE_URL is required.");
  }

  const logger = createServiceLogger(config);
  const database = createEmailDatabase(config.databaseUrl);
  const provider = peers?.provider ?? createProvider(config.email, logger);

  const delivery = new DeliveryService({
    repository: createEmailRepository(database.prisma),
    provider,
    settings: config.email,
    logger,
  });

  const server = createServiceServer({
    config,
    logger,
    probes: [database.probe],
    rpcServer: createEmailRpcServer(delivery),
    routes: (router) => {
      registerEmailRoutes(router, createEmailController(delivery));
    },
  });

  return {
    server,
    logger,
    delivery,
    onShutdown: [async () => database.database.close()],

    prepare: async () => {
      // A misconfigured key should fail on the first deploy, not on the first password reset.
      if (config.email.provider !== "log") {
        try {
          await provider.probe();
          logger.info("Email provider reachable", { event: "email_provider_ready", provider: provider.id });
        } catch {
          logger.warn("The email provider could not be reached at startup", {
            event: "email_provider_unreachable",
            provider: provider.id,
          });
        }
      }
    },
  };
}
