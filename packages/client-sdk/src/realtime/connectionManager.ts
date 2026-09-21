import type {
  ConnectionStatus,
  RealtimeTransport,
  TransportConnection,
} from "./realtime.type.js";

export interface ConnectionManagerOptions {
  readonly transport: RealtimeTransport;
  readonly url: () => string;
  readonly channels: () => readonly string[];
  readonly onOpen: (connection: TransportConnection) => void;
  readonly onMessage: (data: unknown) => void;
  readonly minBackoffMs?: number;
  readonly maxBackoffMs?: number;
  /** Consecutive failed attempts before the status becomes FAILED. Reconnection continues at the longest backoff. */
  readonly failAfterAttempts?: number;
  readonly random?: () => number;
}

export interface ConnectionManager {
  readonly connect: () => void;
  readonly close: () => void;
  /** Drops the current connection and opens a new one, for a changed token or channel list. */
  readonly replace: () => void;
  readonly send: (frame: unknown) => void;
  readonly status: () => ConnectionStatus;
  readonly onStatus: (listener: (status: ConnectionStatus) => void) => () => void;
  readonly lastConnectedAt: () => number | undefined;
}

export function createConnectionManager(
  options: ConnectionManagerOptions,
): ConnectionManager {
  const min = options.minBackoffMs ?? 500;
  const max = options.maxBackoffMs ?? 30_000;
  const failAfter = options.failAfterAttempts ?? 8;
  const random = options.random ?? Math.random;
  const listeners = new Set<(status: ConnectionStatus) => void>();

  let status: ConnectionStatus = "DISCONNECTED";
  let connection: TransportConnection | undefined;
  let attempts = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let wanted = false;
  let connectedAt: number | undefined;

  function setStatus(next: ConnectionStatus): void {
    if (next === status) return;
    status = next;
    for (const listener of listeners) listener(next);
  }

  function schedule(): void {
    if (!wanted) return;

    attempts += 1;
    setStatus(attempts >= failAfter ? "FAILED" : "RECONNECTING");

    const ceiling = Math.min(max, min * 2 ** Math.min(attempts, 16));

    timer = setTimeout(open, random() * ceiling);
  }

  function open(): void {
    timer = undefined;
    if (!wanted) return;

    try {
      const opened = options.transport(
        options.url(),
        {
          onOpen: () => {
            attempts = 0;
            connectedAt = Date.now();
            setStatus("CONNECTED");
            options.onOpen(opened);
          },
          onClose: () => {
            if (connection !== opened) return;
            connection = undefined;
            schedule();
          },
          onMessage: options.onMessage,
        },
        options.channels(),
      );

      connection = opened;
    } catch {
      connection = undefined;
      schedule();
    }
  }

  function drop(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;

    const current = connection;

    connection = undefined;
    current?.close();
  }

  return {
    connect: () => {
      if (wanted) return;
      wanted = true;
      attempts = 0;
      setStatus("CONNECTING");
      open();
    },
    close: () => {
      wanted = false;
      drop();
      setStatus("DISCONNECTED");
    },
    replace: () => {
      if (!wanted) return;
      drop();
      setStatus("RECONNECTING");
      open();
    },
    send: (frame) => {
      connection?.send(frame);
    },
    status: () => status,
    onStatus: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    lastConnectedAt: () => connectedAt,
  };
}
