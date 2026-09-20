import { createServiceLogger, createServiceServer } from "@betng/service-kit";
import type {
  DependencyProbe,
  Logger,
  ServiceConfig,
  ServiceServer,
} from "@betng/service-kit";
import { createMatchController } from "./controllers/index.js";
import { createMatchDatabase } from "./databases/index.js";
import { loadContainer, loadServices } from "./loaders/index.js";
import { createInMemoryMatchRepository } from "./repositories/index.js";
import { registerMatchRoutes } from "./routes/index.js";

export interface MatchApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  readonly onShutdown: readonly (() => Promise<void>)[];
}

export function createApp(config: ServiceConfig): MatchApp {
  const logger = createServiceLogger(config);
  const matches = createInMemoryMatchRepository();

  const container = loadContainer({ matches, logger });

  const probes: DependencyProbe[] = [];
  const onShutdown: (() => Promise<void>)[] = [
    async () => container.dispose(),
  ];

  if (config.databaseUrl !== undefined) {
    const database = createMatchDatabase(config.databaseUrl);
    probes.push(database.probe);
    onShutdown.unshift(async () => database.database.close());
  }

  const controller = createMatchController(loadServices(container));

  const server = createServiceServer({
    config,
    logger,
    probes,
    routes: (router) => {
      registerMatchRoutes(router, controller);
    },
  });

  return { server, logger, onShutdown };
}
