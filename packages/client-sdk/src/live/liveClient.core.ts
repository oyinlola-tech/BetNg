/**
 * The live match stream client.
 *
 * Shared by web, mobile and TV, because all three need the same four things
 * from a live feed and getting any of them wrong is invisible until a match
 * is actually running:
 *
 *   - **Ordering.** Frames carry a per-match `sequence`. A frame that
 *     arrives out of order or twice — a reconnect replaying, a doubled
 *     delivery — is dropped rather than applied, so a score never goes
 *     backwards on screen.
 *
 *   - **Gap detection.** A sequence that jumps means frames were missed.
 *     The client says so through `onDesync` rather than carrying on with a
 *     score that is quietly wrong.
 *
 *   - **Reconnection.** The socket is re-opened with exponential backoff
 *     and full jitter, and every subscription is re-established. A TV left
 *     on overnight survives a network blip without a human touching it.
 *
 *   - **Resynchronisation.** The stream is a projection, never the source
 *     of truth. After a gap or a reconnect the caller re-reads the match
 *     over REST and is correct again — which is why this client keeps no
 *     replay buffer and the server keeps no history.
 */

import { matchChannel } from "@betng/contracts/runtime";
import type { ClientFrame, LiveEvent, ServerFrame } from "@betng/contracts";
import type { BetNgClientConfig } from "../config/index.js";

/** What a subscriber is told. */
export interface LiveHandlers {
  /** One live event, in order, never repeated. */
  readonly onEvent?: (event: LiveEvent) => void;
  /**
   * Frames were missed on a channel, so local state is stale.
   *
   * The caller should re-read the match over REST. Called on a sequence gap
   * and after a reconnect, because both mean the same thing: what is on
   * screen may no longer match what the platform recorded.
   */
  readonly onDesync?: (matchId: string) => void;
  /** The socket opened, or re-opened. */
  readonly onOpen?: () => void;
  /** The socket closed. `willReconnect` is false after `close()`. */
  readonly onClose?: (willReconnect: boolean) => void;
  /** The server rejected something, e.g. an unknown channel. */
  readonly onError?: (code: string, message: string) => void;
}

/** A live connection. */
export interface LiveClient {
  /** Opens the socket. Safe to call more than once. */
  readonly connect: () => void;
  /** Subscribes to a match's events. Re-established across reconnects. */
  readonly subscribe: (matchId: string) => void;
  readonly unsubscribe: (matchId: string) => void;
  /** Closes the socket and stops reconnecting. */
  readonly close: () => void;
  /** Whether the socket is currently open. */
  readonly isConnected: () => boolean;
}

/** Backoff bounds. The first retry is near-immediate; the cap keeps a
 *  long outage from turning into a thundering herd when the service
 *  returns. */
const MIN_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;

/** The WebSocket constructor, which differs between web and React Native. */
type WebSocketLike = {
  new (url: string): {
    send(data: string): void;
    close(): void;
    readyState: number;
    onopen: (() => void) | null;
    onclose: (() => void) | null;
    onerror: (() => void) | null;
    onmessage: ((event: { data: unknown }) => void) | null;
  };
};

export interface LiveClientOptions {
  readonly config: BetNgClientConfig;
  readonly handlers?: LiveHandlers;
  /**
   * The WebSocket implementation. Defaults to the global one, which both
   * browsers and React Native provide; injected by the tests.
   */
  readonly webSocket?: WebSocketLike;
}

/**
 * Creates a live match stream client.
 *
 * @param options - Where the event service is, and what to call back.
 * @returns A client that stays connected and keeps its subscriptions.
 */
export function createLiveClient(options: LiveClientOptions): LiveClient {
  const { config, handlers = {} } = options;

  const resolved =
    options.webSocket ?? (globalThis as { WebSocket?: WebSocketLike }).WebSocket;

  if (resolved === undefined) {
    throw new Error(
      "No WebSocket implementation is available. Pass one as " +
        "`options.webSocket`.",
    );
  }

  const Socket: WebSocketLike = resolved;

  type Connection = InstanceType<WebSocketLike>;

  let socket: Connection | undefined;
  let closedByCaller = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  /** Channels the caller wants, independent of whether the socket is up. */
  const wanted = new Set<string>();
  /** The last sequence applied per channel, for ordering and gap detection. */
  const lastSequence = new Map<string, number>();

  function send(frame: ClientFrame): void {
    if (socket !== undefined && socket.readyState === 1) {
      socket.send(JSON.stringify(frame));
    }
  }

  function handleEvent(channel: string, event: LiveEvent): void {
    const previous = lastSequence.get(channel);

    // Already applied, or arrived out of order: dropping is the only safe
    // choice, because applying it would move the score backwards.
    if (previous !== undefined && event.sequence <= previous) {
      return;
    }

    // A jump of more than one means frames were missed.
    if (previous !== undefined && event.sequence > previous + 1) {
      handlers.onDesync?.(event.matchId);
    }

    lastSequence.set(channel, event.sequence);
    handlers.onEvent?.(event);
  }

  function handleFrame(raw: unknown): void {
    if (typeof raw !== "string") return;

    let frame: ServerFrame;

    try {
      frame = JSON.parse(raw) as ServerFrame;
    } catch {
      return;
    }

    switch (frame.type) {
      case "EVENT":
        handleEvent(frame.channel, frame.event);
        return;

      case "SUBSCRIBED": {
        // The server says where the channel has got to. If it is ahead of
        // what we have applied, we joined mid-match or missed frames while
        // away — either way the caller must re-read the match.
        const applied = lastSequence.get(frame.channel);

        if (applied === undefined) {
          lastSequence.set(frame.channel, frame.lastSequence);
        } else if (frame.lastSequence > applied) {
          lastSequence.set(frame.channel, frame.lastSequence);
          const matchId = frame.channel.replace("match:", "");
          handlers.onDesync?.(matchId);
        }
        return;
      }

      case "PING":
        send({ type: "PONG" });
        return;

      case "ERROR":
        handlers.onError?.(frame.code, frame.message);
        return;

      default:
        return;
    }
  }

  function scheduleReconnect(): void {
    if (closedByCaller) return;

    // Exponential backoff with full jitter: without the jitter every client
    // watching the same match reconnects in the same millisecond.
    const ceiling = Math.min(MAX_BACKOFF_MS, MIN_BACKOFF_MS * 2 ** attempt);
    const delay = Math.random() * ceiling;

    attempt += 1;
    retryTimer = setTimeout(open, delay);
  }

  function open(): void {
    if (closedByCaller) return;

    const connection = new Socket(config.liveUrl);
    socket = connection;

    connection.onopen = (): void => {
      attempt = 0;
      handlers.onOpen?.();

      // Re-establish every subscription. The server assigns no state to a
      // connection, so a reconnect starts from nothing until we ask again.
      for (const channel of wanted) {
        send({ type: "SUBSCRIBE", channel });
      }
    };

    connection.onmessage = (event): void => {
      handleFrame(event.data);
    };

    connection.onclose = (): void => {
      socket = undefined;
      handlers.onClose?.(!closedByCaller);
      scheduleReconnect();
    };

    // `onerror` is always followed by `onclose`, so reconnection is handled
    // there and this only exists to stop an unhandled error event.
    connection.onerror = (): void => {
      /* Reported through onClose. */
    };
  }

  return {
    connect: () => {
      if (socket !== undefined) return;
      closedByCaller = false;
      open();
    },

    subscribe: (matchId) => {
      const channel = matchChannel(matchId);
      wanted.add(channel);
      send({ type: "SUBSCRIBE", channel });
    },

    unsubscribe: (matchId) => {
      const channel = matchChannel(matchId);
      wanted.delete(channel);
      lastSequence.delete(channel);
      send({ type: "UNSUBSCRIBE", channel });
    },

    close: () => {
      closedByCaller = true;

      if (retryTimer !== undefined) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
      }

      socket?.close();
      socket = undefined;
      wanted.clear();
      lastSequence.clear();
    },

    isConnected: () => socket !== undefined && socket.readyState === 1,
  };
}
