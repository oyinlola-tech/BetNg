import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createConnectionManager,
  createRealtimeClient,
  type RealtimeTransport,
  type TransportHandlers,
} from "../src/realtime/index.js";

interface FakeConnection {
  readonly handlers: TransportHandlers;
  readonly channels: readonly string[];
  readonly sent: unknown[];
  closed: boolean;
}

function fakeTransport(options: { readonly failFirst?: number } = {}): {
  transport: RealtimeTransport;
  connections: FakeConnection[];
  attempts: () => number;
} {
  const connections: FakeConnection[] = [];
  let attempts = 0;

  return {
    connections,
    attempts: () => attempts,
    transport: (_url, handlers, channels) => {
      attempts += 1;

      if (attempts <= (options.failFirst ?? 0))
        throw new Error("socket refused");

      const connection: FakeConnection = {
        handlers,
        channels,
        sent: [],
        closed: false,
      };

      connections.push(connection);

      return {
        duplex: true,
        send: (frame) => connection.sent.push(frame),
        close: () => {
          connection.closed = true;
        },
      };
    },
  };
}

const last = <T>(items: readonly T[]): T => {
  const item = items.at(-1);

  if (item === undefined) throw new Error("nothing opened");

  return item;
};

const event = (channel: string, sequence: number): string =>
  JSON.stringify({ type: "EVENT", channel, event: { type: "GOAL", sequence } });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("reconnection backoff", () => {
  function manager(transport: RealtimeTransport) {
    return createConnectionManager({
      transport,
      url: () => "ws://x/live",
      channels: () => [],
      onOpen: () => undefined,
      onMessage: () => undefined,
      minBackoffMs: 500,
      maxBackoffMs: 4_000,
      failAfterAttempts: 10,
      random: () => 1,
    });
  }

  it("waits longer after each failed attempt, up to the ceiling", () => {
    const fake = fakeTransport();
    const connection = manager(fake.transport);

    connection.connect();

    for (const wait of [1_000, 2_000, 4_000, 4_000]) {
      const before = fake.connections.length;

      last(fake.connections).handlers.onClose();
      vi.advanceTimersByTime(wait - 1);
      expect(fake.connections).toHaveLength(before);

      vi.advanceTimersByTime(1);
      expect(fake.connections).toHaveLength(before + 1);
    }
  });

  it("starts the backoff again once a connection opens", () => {
    const fake = fakeTransport();
    const connection = manager(fake.transport);

    connection.connect();
    last(fake.connections).handlers.onClose();
    vi.advanceTimersByTime(1_000);
    last(fake.connections).handlers.onClose();
    vi.advanceTimersByTime(2_000);
    last(fake.connections).handlers.onOpen();
    last(fake.connections).handlers.onClose();

    vi.advanceTimersByTime(999);
    expect(fake.connections).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(fake.connections).toHaveLength(4);
  });

  it("retries when the transport cannot even be created", () => {
    const fake = fakeTransport({ failFirst: 2 });
    const statuses: string[] = [];
    const connection = manager(fake.transport);

    connection.onStatus((status) => statuses.push(status));
    connection.connect();
    vi.advanceTimersByTime(1_000);
    vi.advanceTimersByTime(2_000);
    last(fake.connections).handlers.onOpen();

    expect(fake.attempts()).toBe(3);
    expect(statuses).toEqual(["CONNECTING", "RECONNECTING", "CONNECTED"]);
  });

  it("keeps trying at the ceiling after reporting FAILED, and recovers", () => {
    const fake = fakeTransport();
    const connection = createConnectionManager({
      transport: fake.transport,
      url: () => "ws://x/live",
      channels: () => [],
      onOpen: () => undefined,
      onMessage: () => undefined,
      minBackoffMs: 500,
      maxBackoffMs: 1_000,
      failAfterAttempts: 2,
      random: () => 1,
    });

    connection.connect();
    last(fake.connections).handlers.onClose();
    vi.advanceTimersByTime(1_000);
    last(fake.connections).handlers.onClose();

    expect(connection.status()).toBe("FAILED");

    vi.advanceTimersByTime(1_000);
    last(fake.connections).handlers.onClose();
    vi.advanceTimersByTime(1_000);
    last(fake.connections).handlers.onOpen();

    expect(connection.status()).toBe("CONNECTED");
    expect(fake.connections).toHaveLength(4);
  });
});

describe("realtime client across a disconnect", () => {
  it("resubscribes what is wanted when the connection returns, not what was released while it was down", () => {
    const fake = fakeTransport();
    const client = createRealtimeClient({
      url: "ws://x/live",
      transport: fake.transport,
      random: () => 0,
    });

    client.subscribe("match:1", () => undefined);
    const leave = client.subscribe("match:2", () => undefined);

    client.connect();
    last(fake.connections).handlers.onOpen();
    last(fake.connections).handlers.onClose();

    client.subscribe("match:3", () => undefined);
    leave();

    expect(fake.connections[0]?.sent).toEqual([
      { type: "SUBSCRIBE", channel: "match:1" },
      { type: "SUBSCRIBE", channel: "match:2" },
    ]);

    vi.advanceTimersByTime(0);
    last(fake.connections).handlers.onOpen();

    expect(last(fake.connections).sent).toEqual([
      { type: "SUBSCRIBE", channel: "match:1" },
      { type: "SUBSCRIBE", channel: "match:3" },
    ]);
  });

  it("keeps the last connected time while reconnecting so live data can be marked stale", () => {
    vi.setSystemTime(new Date("2026-09-22T10:00:00.000Z"));

    const fake = fakeTransport();
    const client = createRealtimeClient({
      url: "ws://x/live",
      transport: fake.transport,
      minBackoffMs: 500,
      random: () => 1,
    });

    client.connect();
    last(fake.connections).handlers.onOpen();

    const connectedAt = client.lastConnectedAt();

    vi.setSystemTime(new Date("2026-09-22T10:00:30.000Z"));
    last(fake.connections).handlers.onClose();

    expect(client.status()).toBe("RECONNECTING");
    expect(client.lastConnectedAt()).toBe(connectedAt);

    vi.advanceTimersByTime(1_000);
    last(fake.connections).handlers.onOpen();

    expect(client.status()).toBe("CONNECTED");
    expect(client.lastConnectedAt()).toBeGreaterThan(connectedAt ?? 0);
  });

  it("asks for a resync when the server moved on while the connection was down, and not otherwise", () => {
    const fake = fakeTransport();
    const client = createRealtimeClient({
      url: "ws://x/live",
      transport: fake.transport,
      random: () => 0,
    });
    const got: number[] = [];
    const desynced: string[] = [];

    client.subscribe("match:1", (e) => got.push(e.sequence ?? -1));
    client.subscribe("match:2", () => undefined);
    client.onDesync((channel) => desynced.push(channel));
    client.connect();

    const first = last(fake.connections);

    first.handlers.onOpen();
    first.handlers.onMessage(event("match:1", 1));
    first.handlers.onMessage(event("match:1", 2));
    first.handlers.onMessage(event("match:2", 4));
    first.handlers.onClose();

    vi.advanceTimersByTime(0);

    const second = last(fake.connections);

    second.handlers.onOpen();
    second.handlers.onMessage(
      JSON.stringify({
        type: "SUBSCRIBED",
        channel: "match:1",
        lastSequence: 6,
      }),
    );
    second.handlers.onMessage(
      JSON.stringify({
        type: "SUBSCRIBED",
        channel: "match:2",
        lastSequence: 4,
      }),
    );
    second.handlers.onMessage(event("match:1", 5));
    second.handlers.onMessage(event("match:1", 7));

    expect(desynced).toEqual(["match:1"]);
    expect(got).toEqual([1, 2, 7]);
  });

  it("ignores a close from a connection it already replaced", () => {
    const fake = fakeTransport();
    const client = createRealtimeClient({
      url: "ws://x/live",
      transport: fake.transport,
      random: () => 0,
    });

    client.connect();
    fake.connections[0]?.handlers.onOpen();
    client.replaceConnection();
    fake.connections[1]?.handlers.onOpen();
    fake.connections[0]?.handlers.onClose();
    vi.advanceTimersByTime(60_000);

    expect(fake.connections).toHaveLength(2);
    expect(client.status()).toBe("CONNECTED");
  });

  it("stops reconnecting once closed, even mid-backoff", () => {
    const fake = fakeTransport();
    const client = createRealtimeClient({
      url: "ws://x/live",
      transport: fake.transport,
      random: () => 1,
    });

    client.connect();
    last(fake.connections).handlers.onOpen();
    last(fake.connections).handlers.onClose();
    client.close();
    vi.advanceTimersByTime(60_000);

    expect(fake.connections).toHaveLength(1);
    expect(client.status()).toBe("DISCONNECTED");
  });
});
