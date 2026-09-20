/**
 * Assembles the event service.
 *
 * This is the one BetNG service that serves two protocols, so it is the one
 * that creates its own `http.Server`: ZudoJS's node adapter serves REST on it
 * and the WebSocket adapter attaches its `upgrade` handler to the same
 * server. One process, one port — a client reads a match over REST and
 * subscribes to its live stream on the same origin.
 *
 * `@zudojs/adapters` defines the `WebSocketAdapter` contract and ships no
 * implementation; `@betng/service-kit` provides BetNG's, backed by `ws`.
 */

import { createServer } from "node:http";
import type { Server } from "node:http";
import { createServiceLogger, createServiceServer } from "@betng/service-kit";
import type {
  BetNgWebSocketAdapter,
  Logger,
  ServiceConfig,
  ServiceServer,
} from "@betng/service-kit";
import { createWebSocketAdapter } from "@betng/service-kit";
import { LIVE_PATH } from "./configs/index.js";
import { createEventController, createLiveController } from "./controllers/index.js";
import { loadContainer, loadHeartbeat, loadServices } from "./loaders/index.js";
import { createEventRpcServer } from "./procedures/index.js";
import { createInMemoryChannelRegistry } from "./repositories/index.js";
import { registerEventRoutes } from "./routes/index.js";

/** The assembled event service. */
export interface EventApp {
  readonly server: ServiceServer;
  readonly logger: Logger;
  /** The WebSocket adapter, for tests and for shutdown. */
  readonly websocket: BetNgWebSocketAdapter;
  /** Released on shutdown, in order, after the listener closes. */
  readonly onShutdown: readonly (() => Promise<void>)[];
}

/**
 * Builds the event service from its configuration.
 *
 * @param config - The configuration read from the environment.
 * @param httpServer - The server to serve on. Created when omitted; the
 *   tests pass their own so they can bind an ephemeral port.
 * @returns The HTTP server, the WebSocket adapter and the shutdown steps.
 */
export function createApp(
  config: ServiceConfig,
  httpServer: Server = createServer(),
): EventApp {
  const logger = createServiceLogger(config);
  const channels = createInMemoryChannelRegistry();
  const container = loadContainer({ channels, logger });
  const { commandBus, queryBus } = loadServices(container);

  const live = createLiveController({ channels, queryBus, logger });

  const websocket = createWebSocketAdapter({
    server: httpServer,
    path: LIVE_PATH,
    logger,
    onConnection: (session) => {
      live.onConnection(session);
    },
    onMessage: (session, data) => {
      // A client frame must never take the connection — or the service —
      // down; a rejected frame is answered and the socket stays open.
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

  const server = createServiceServer({
    config,
    logger,
    server: httpServer,
    rpcServer: createEventRpcServer(commandBus),
    // The event service reaches nothing: it holds subscriptions in memory
    // and is handed events to relay. An empty list is the honest answer.
    probes: [],
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
        stopHeartbeat();
        await websocket.shutdown();
      },
      async () => container.dispose(),
    ],
  };
}
