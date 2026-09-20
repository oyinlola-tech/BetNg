/**
 * A WebSocket adapter backed by the `ws` library.
 *
 * `@zudojs/adapters` defines the `WebSocketAdapter` and `WebSocketSession`
 * contracts but ships no implementation — the contract is the boundary, and
 * binding it to a provider is the application's job. This is BetNG's binding.
 *
 * It attaches to an existing `http.Server` through the `upgrade` event, and
 * that server is the same one `createNodeHttpAdapter({ server })` serves HTTP
 * on. One process, one port: a client reads a match over REST and subscribes
 * to its live stream on the same origin, with no second thing to deploy,
 * expose or health-check.
 */

import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import type {
  WebSocketAdapter,
  WebSocketReadyState,
  WebSocketSession,
} from "@zudojs/adapters";
import type { Logger } from "@zudojs/logger";
import { WebSocket, WebSocketServer } from "ws";

export interface WebSocketAdapterOptions {
  readonly server: Server;
  readonly path: string;
  readonly logger: Logger;
  readonly onConnection: (
    session: WebSocketSession,
    request: IncomingMessage,
  ) => void;
  readonly onMessage: (session: WebSocketSession, data: string) => void;
  readonly onClose: (session: WebSocketSession) => void;
}

export interface BetNgWebSocketAdapter extends WebSocketAdapter {
  readonly sessions: () => readonly WebSocketSession[];
  readonly shutdown: () => Promise<void>;
}

/**
 * A frame larger than this is refused before it is buffered.
 *
 * Clients only ever send `SUBSCRIBE`, `UNSUBSCRIBE` and `PONG`, none of which
 * approach a kilobyte. The limit exists so one connection cannot make the
 * process allocate without bound.
 */
const MAX_FRAME_BYTES = 4 * 1024;

/**
 * The ready-state values `@zudojs/adapters` documents.
 *
 * The package defines `WebSocketReadyState` as an enum and its runtime values
 * do ship, but the package barrel re-exports the name with `export type` and
 * the package declares no subpath exports, so the enum cannot be reached as a
 * value. The numbers are part of the published contract — and identical to
 * the WHATWG `WebSocket` ready states — so they are restated here and the
 * result is still typed as `WebSocketReadyState`.
 */
const READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const satisfies Record<string, WebSocketReadyState>;

function readyStateOf(socket: WebSocket): WebSocketReadyState {
  switch (socket.readyState) {
    case WebSocket.CONNECTING:
      return READY_STATE.CONNECTING;
    case WebSocket.OPEN:
      return READY_STATE.OPEN;
    case WebSocket.CLOSING:
      return READY_STATE.CLOSING;
    default:
      return READY_STATE.CLOSED;
  }
}

function createSession(socket: WebSocket): WebSocketSession {
  const id = crypto.randomUUID();

  return {
    id,

    get readyState(): WebSocketReadyState {
      return readyStateOf(socket);
    },

    close(code?: number, reason?: string): void {
      socket.close(code, reason);
    },

    send(data: string | ArrayBuffer | Uint8Array): void {
      // Sending on a socket the peer has already closed throws; a client
      // that vanished mid-broadcast must not take the broadcast down.
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    },
  };
}

export function createWebSocketAdapter(
  options: WebSocketAdapterOptions,
): BetNgWebSocketAdapter {
  const { server, path, logger } = options;

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_FRAME_BYTES,
  });

  const sessions = new Map<WebSocketSession, WebSocket>();

  const onUpgrade = (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void => {
    // An upgrade on any other path is not ours. Destroying the socket rather
    // than ignoring it stops a half-open connection accumulating.
    const requestPath = (request.url ?? "/").split("?")[0];

    if (requestPath !== path) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const session = createSession(ws);
      sessions.set(session, ws);

      ws.on("message", (raw, isBinary) => {
        // The protocol is JSON text. A binary frame is not something a BetNG
        // client sends, so it is dropped rather than guessed at.
        if (isBinary) return;

        options.onMessage(session, raw.toString());
      });

      ws.on("close", () => {
        sessions.delete(session);
        options.onClose(session);
      });

      ws.on("error", (error: Error) => {
        logger.warn("WebSocket connection failed", {
          connectionId: session.id,
          error: error.message,
        });
      });

      options.onConnection(session, request);
    });
  };

  server.on("upgrade", onUpgrade);

  return {
    name: "betng-websocket",

    version: "0.1.0",

    capabilities: { websocket: true, gracefulShutdown: true },

    metadata: {
      name: "betng-websocket",
      version: "0.1.0",
      description: `BetNG live match stream, served at ${path}.`,
      runtime: "node >=24",
    },

    accept: async (connection: unknown): Promise<WebSocketSession> => {
      // Connections arrive through the server's upgrade event, which is the
      // only way a WebSocket can be established over an HTTP listener.
      // Nothing calls this, and answering it honestly is better than
      // pretending a second acceptance path exists.
      void connection;
      throw new Error(
        "Connections are accepted through the HTTP server's upgrade event, " +
          "not by calling accept().",
      );
    },

    close: async (
      session: WebSocketSession,
      code?: number,
      reason?: string,
    ): Promise<void> => {
      session.close(code, reason);
    },

    send: async (
      session: WebSocketSession,
      data: string | ArrayBuffer | Uint8Array,
    ): Promise<void> => {
      session.send(data);
    },

    broadcast: async (
      data: string | ArrayBuffer | Uint8Array,
    ): Promise<void> => {
      for (const session of sessions.keys()) {
        session.send(data);
      }
    },

    sessions: () => [...sessions.keys()],

    shutdown: async (): Promise<void> => {
      server.off("upgrade", onUpgrade);

      for (const session of sessions.keys()) {
        session.close(1001, "Server shutting down");
      }

      sessions.clear();

      await new Promise<void>((resolve) => {
        wss.close(() => {
          resolve();
        });
      });
    },
  };
}
