import {
  createServiceClient,
  createServiceLogger,
  createServiceServer,
  serviceProbe,
} from "@betng/service-kit";
import type {
  DependencyProbe,
  Logger,
  ServiceConfig,
  ServiceServer,
} from "@betng/service-kit";
import {
  createOddsClient,
  createRiskClient,
  createRpcRiskGate,
} from "./clients/index.js";
import { createBettingController } from "./controllers/index.js";
import { createBettingDatabase } from "./databases/index.js";
import { loadContainer, loadEvents, loadServices } from "./loaders/index.js";
import { createInMemoryBetRepository } from "./repositories/index.js";
import { registerBettingRoutes } from "./routes/index.js";

export interface BettingApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  readonly onShutdown: readonly (() => Promise<void>)[];
}

export function createApp(config: ServiceConfig): BettingApp {
  const logger = createServiceLogger(config);
  const bets = createInMemoryBetRepository();

  const events = loadEvents(logger);

  // Betting reaches two internal peers, both over RPC: risk on the
  // placement path, and odds for pricing. Their addresses come from
  // configuration, never from a literal.
  const risk = createRiskClient(config.services.risk);
  const odds = createOddsClient(config.services.odds);

  const container = loadContainer({
    bets,
    events,
    risk: createRpcRiskGate(risk, logger),
    logger,
  });

  // Risk and odds are advisory on this service's critical path: betting
  // accepts a slip unassessed rather than refusing every bet when they are
  // unreachable, so an outage degrades this service rather than stopping it.
  //
  // The probe asks each peer's `/health`, because readiness is "is the peer
  // up". Whether RPC itself works is proved by the calls the placement path
  // actually makes, not by a synthetic procedure invented for a probe.
  const probes: DependencyProbe[] = [
    serviceProbe(createServiceClient(config.services.risk), { optional: true }),
    serviceProbe(createServiceClient(config.services.odds), { optional: true }),
  ];

  const onShutdown: (() => Promise<void>)[] = [
    async () => {
      await risk.raw.close();
      await odds.raw.close();
      events.dispose();
      await container.dispose();
    },
  ];

  if (config.databaseUrl !== undefined) {
    const database = createBettingDatabase(config.databaseUrl);
    probes.push(database.probe);
    onShutdown.unshift(async () => database.database.close());
  }

  const controller = createBettingController(loadServices(container));

  const server = createServiceServer({
    config,
    logger,
    probes,
    routes: (router) => {
      registerBettingRoutes(router, controller);
    },
  });

  return { server, logger, onShutdown };
}
