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
import {
  WebSocketReadyState,
  type WebSocketAdapter,
  type WebSocketSession,
} from "@zudojs/adapters";
import type { Logger } from "@zudojs/logger";
import { WebSocket, WebSocketServer } from "ws";

/** What the adapter needs to attach itself to a server. */
export interface WebSocketAdapterOptions {
  /** The HTTP server to accept upgrades on. */
  readonly server: Server;
  /** The path clients connect to, e.g. `/live`. */
  readonly path: string;
  readonly logger: Logger;
  /** Called once per accepted connection. */
  readonly onConnection: (
    session: WebSocketSession,
    request: IncomingMessage,
  ) => void;
  /** Called for each text frame a client sends. */
  readonly onMessage: (session: WebSocketSession, data: string) => void;
  /** Called once when a connection closes, however it closed. */
  readonly onClose: (session: WebSocketSession) => void;
}

/** The adapter, plus the lifecycle the event service drives. */
export interface BetNgWebSocketAdapter extends WebSocketAdapter {
  /** Every currently open session. */
  readonly sessions: () => readonly WebSocketSession[];
  /** Stops accepting upgrades and closes every open session. */
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

function readyStateOf(socket: WebSocket): WebSocketReadyState {
  switch (socket.readyState) {
    case WebSocket.CONNECTING:
      return WebSocketReadyState.CONNECTING;
    case WebSocket.OPEN:
      return WebSocketReadyState.OPEN;
    case WebSocket.CLOSING:
      return WebSocketReadyState.CLOSING;
    default:
      return WebSocketReadyState.CLOSED;
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

/**
 * Creates the WebSocket adapter and attaches it to an HTTP server.
 *
 * @param options - The server to attach to and the callbacks to drive.
 * @returns The adapter, implementing `@zudojs/adapters`' contract.
 */
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

    capabilities: { websockets: true },

    metadata: { path },

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
