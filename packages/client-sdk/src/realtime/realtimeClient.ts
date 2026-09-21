import { createConnectionManager } from "./connectionManager.js";
import { createEventRouter, type RealtimeListener } from "./eventRouter.js";
import type {
  ConnectionStatus,
  RealtimeAuthMode,
  RealtimeEvent,
  RealtimeEventType,
  RealtimeTransport,
} from "./realtime.type.js";
import { createSubscriptionManager } from "./subscriptionManager.js";

export interface RealtimeClientOptions {
  readonly url: string;
  readonly transport: RealtimeTransport;
  readonly getToken?: () => string | undefined;
  readonly authMode?: RealtimeAuthMode;
  readonly onUnauthorized?: () => void;
  readonly onProtocolError?: (code: string, message: string) => void;
  readonly minBackoffMs?: number;
  readonly maxBackoffMs?: number;
  readonly failAfterAttempts?: number;
  readonly random?: () => number;
}

export interface RealtimeClient {
  readonly connect: () => void;
  readonly close: () => void;
  readonly subscribe: (channel: string, listener: RealtimeListener) => () => void;
  readonly on: (type: RealtimeEventType, listener: RealtimeListener) => () => void;
  /** A channel missed events and its state must be re-read from the platform. */
  readonly onDesync: (listener: (channel: string) => void) => () => void;
  readonly status: () => ConnectionStatus;
  readonly onStatus: (listener: (status: ConnectionStatus) => void) => () => void;
  readonly lastConnectedAt: () => number | undefined;
  /** Reopens the connection, for a session that was replaced or renewed. */
  readonly replaceConnection: () => void;
}

const AUTH_CODES = new Set(["UNAUTHENTICATED", "SESSION_EXPIRED"]);

interface Frame {
  readonly type?: unknown;
  readonly channel?: unknown;
  readonly lastSequence?: unknown;
  readonly event?: unknown;
  readonly code?: unknown;
  readonly message?: unknown;
}

function toEvent(frame: Frame): RealtimeEvent | undefined {
  if (typeof frame.channel !== "string") return undefined;
  if (typeof frame.event !== "object" || frame.event === null) return undefined;

  const body = frame.event as Record<string, unknown>;

  if (typeof body["type"] !== "string") return undefined;

  const sequence = typeof body["sequence"] === "number" ? body["sequence"] : undefined;
  const id =
    typeof body["eventId"] === "string"
      ? body["eventId"]
      : typeof body["id"] === "string"
        ? body["id"]
        : sequence === undefined
          ? undefined
          : `${frame.channel}#${String(sequence)}`;
  const timestamp =
    typeof body["occurredAt"] === "string"
      ? body["occurredAt"]
      : typeof body["timestamp"] === "string"
        ? body["timestamp"]
        : undefined;

  return {
    type: body["type"] as RealtimeEventType,
    channel: frame.channel,
    payload: body,
    ...(id === undefined ? {} : { id }),
    ...(sequence === undefined ? {} : { sequence }),
    ...(typeof body["version"] === "number" ? { version: body["version"] } : {}),
    ...(timestamp === undefined ? {} : { timestamp }),
  };
}

export function createRealtimeClient(options: RealtimeClientOptions): RealtimeClient {
  const authMode = options.authMode ?? "none";
  const subscriptions = createSubscriptionManager();
  const router = createEventRouter();
  let duplex = true;

  function url(): string {
    const token = options.getToken?.();

    if (authMode !== "query" || token === undefined) return options.url;

    const target = new URL(options.url);

    target.searchParams.set("access_token", token);

    return target.toString();
  }

  function handle(data: unknown): void {
    let frame: Frame;

    try {
      frame = JSON.parse(String(data)) as Frame;
    } catch {
      return;
    }

    switch (frame.type) {
      case "EVENT": {
        const event = toEvent(frame);

        if (event !== undefined && subscriptions.has(event.channel)) router.dispatch(event);

        return;
      }
      case "SUBSCRIBED":
        if (typeof frame.channel === "string" && typeof frame.lastSequence === "number") {
          router.acknowledge(frame.channel, frame.lastSequence);
        }

        return;
      case "PING":
        manager.send({ type: "PONG" });

        return;
      case "ERROR": {
        const code = typeof frame.code === "string" ? frame.code : "UNKNOWN";

        if (AUTH_CODES.has(code)) options.onUnauthorized?.();

        options.onProtocolError?.(code, typeof frame.message === "string" ? frame.message : "");

        return;
      }
      default:
        return;
    }
  }

  const manager = createConnectionManager({
    transport: options.transport,
    url,
    channels: subscriptions.channels,
    onMessage: handle,
    onOpen: (connection) => {
      const token = options.getToken?.();

      duplex = connection.duplex;

      if (authMode === "frame" && token !== undefined) connection.send({ type: "AUTH", token });
      if (!connection.duplex) return;

      for (const channel of subscriptions.channels()) connection.send({ type: "SUBSCRIBE", channel });
    },
    ...(options.minBackoffMs === undefined ? {} : { minBackoffMs: options.minBackoffMs }),
    ...(options.maxBackoffMs === undefined ? {} : { maxBackoffMs: options.maxBackoffMs }),
    ...(options.failAfterAttempts === undefined ? {} : { failAfterAttempts: options.failAfterAttempts }),
    ...(options.random === undefined ? {} : { random: options.random }),
  });

  function changeChannels(frame: { type: "SUBSCRIBE" | "UNSUBSCRIBE"; channel: string }): void {
    if (manager.status() !== "CONNECTED") return;
    if (duplex) manager.send(frame);
    else manager.replace();
  }

  return {
    connect: manager.connect,
    close: () => {
      manager.close();
    },
    subscribe: (channel, listener) => {
      const stop = router.onChannel(channel, listener);

      if (subscriptions.add(channel)) changeChannels({ type: "SUBSCRIBE", channel });

      let active = true;

      return () => {
        if (!active) return;
        active = false;
        stop();

        if (subscriptions.remove(channel)) {
          router.forget(channel);
          changeChannels({ type: "UNSUBSCRIBE", channel });
        }
      };
    },
    on: router.onType,
    onDesync: router.onGap,
    status: manager.status,
    onStatus: manager.onStatus,
    lastConnectedAt: manager.lastConnectedAt,
    replaceConnection: manager.replace,
  };
}
