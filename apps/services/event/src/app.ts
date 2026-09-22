// One http.Server carries REST (the node adapter) and the WebSocket upgrade, so the service needs one port.

import { createServer } from "node:http";
import type { Server } from "node:http";
import {
  createRpcClient,
  createServiceClient,
  createServiceLogger,
  createServiceServer,
  createWebSocketAdapter,
  serviceProbe,
} from "@betng/service-kit";
import type { BetNgWebSocketAdapter, Logger, ServiceConfig, ServiceServer } from "@betng/service-kit";
import { createIdentityAuthenticator } from "./clients/index.js";
import type { SessionAuthenticator } from "./clients/index.js";
import { LIVE_PATH, loadLiveSettings } from "./configs/index.js";
import type { LiveSettings } from "./configs/index.js";
import { createEventController, createLiveController } from "./controllers/index.js";
import { loadContainer, loadHeartbeat, loadRevalidation, loadServices } from "./loaders/index.js";
import { createEventRpcServer } from "./procedures/index.js";
import { createInMemoryChannelRegistry } from "./repositories/index.js";
import { registerEventRoutes } from "./routes/index.js";
import { clientAddress, queryToken } from "./utils/index.js";

export interface EventApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  readonly websocket: BetNgWebSocketAdapter;
  readonly onShutdown: readonly (() => Promise<void>)[];
}

export interface EventAppOverrides {
  readonly httpServer?: Server;
  readonly settings?: LiveSettings;
  readonly authenticator?: SessionAuthenticator;
}

export function createApp(config: ServiceConfig, overrides: EventAppOverrides = {}): EventApp {
  const httpServer = overrides.httpServer ?? createServer();
  const settings = overrides.settings ?? loadLiveSettings();
  const logger = createServiceLogger(config);
  const channels = createInMemoryChannelRegistry();
  const container = loadContainer({ channels, logger });
  const { commandBus, queryBus } = loadServices(container);
  const identityRpc = createRpcClient(config.services.identity);

  const live = createLiveController({
    channels,
    queryBus,
    logger,
    settings,
    authenticator: overrides.authenticator ?? createIdentityAuthenticator(identityRpc),
  });

  const websocket = createWebSocketAdapter({
    server: httpServer,
    path: LIVE_PATH,
    logger,
    maxConnectionsPerAddress: settings.maxConnectionsPerIp,
    addressOf: (request) => clientAddress(request, settings.trustedProxyHops),
    onConnection: (session, request) => {
      const token = queryToken(request);

      live.onConnection(session, {
        address: clientAddress(request, settings.trustedProxyHops),
        ...(token === undefined ? {} : { token }),
      });
    },
    onMessage: (session, data) => {
      void live.onMessage(session, data).catch((error: unknown) => {
        logger.warn("Live frame failed", {
          connectionId: session.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    },
    onClose: (session) => {
      live.onClose(session);
    },
  });

  const stopHeartbeat = loadHeartbeat(channels, logger);
  const stopRevalidation = loadRevalidation(live, settings.revalidateMs, logger);

  const server = createServiceServer({
    config,
    logger,
    server: httpServer,
    rpcServer: createEventRpcServer(commandBus, live),
    probes: [serviceProbe(createServiceClient(config.services.identity), { optional: true })],
    routes: (router) => {
      registerEventRoutes(router, createEventController(queryBus));
    },
  });

  return {
    server,
    logger,
    websocket,
    onShutdown: [
      async () => {
        stopRevalidation();
        stopHeartbeat();
        await websocket.shutdown();
      },
      async () => identityRpc.close(),
      async () => container.dispose(),
    ],
  };
}
