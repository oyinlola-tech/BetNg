import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createConnectionManager,
  createEventRouter,
  createRealtimeClient,
  createSubscriptionManager,
  type RealtimeEvent,
  type RealtimeTransport,
  type TransportHandlers,
} from "../src/realtime/index.js";

interface FakeConnection {
  readonly url: string;
  readonly channels: readonly string[];
  readonly handlers: TransportHandlers;
  readonly sent: unknown[];
  closed: boolean;
}

function fakeTransport(duplex = true): { transport: RealtimeTransport; connections: FakeConnection[] } {
  const connections: FakeConnection[] = [];

  return {
    connections,
    transport: (url, handlers, channels) => {
      const connection: FakeConnection = { url, channels, handlers, sent: [], closed: false };

      connections.push(connection);

      return {
        duplex,
        send: (frame) => connection.sent.push(frame),
        close: () => {
          connection.closed = true;
        },
      };
    },
  };
}

const frame = (channel: string, event: Record<string, unknown>): string =>
  JSON.stringify({ type: "EVENT", channel, event });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("subscription manager", () => {
  it("counts holders so a channel is requested once and released last", () => {
    const subs = createSubscriptionManager();

    expect(subs.add("match:1")).toBe(true);
    expect(subs.add("match:1")).toBe(false);
    expect(subs.remove("match:1")).toBe(false);
    expect(subs.remove("match:1")).toBe(true);
    expect(subs.channels()).toEqual([]);
  });
});

describe("event router", () => {
  const event = (over: Partial<RealtimeEvent>): RealtimeEvent => ({ type: "GOAL", channel: "match:1", payload: {}, ...over });

  it("drops a duplicate id and anything at or below the last sequence", () => {
    const router = createEventRouter();
    const seen: number[] = [];

    router.onChannel("match:1", (e) => seen.push(e.sequence ?? -1));

    expect(router.dispatch(event({ id: "a", sequence: 1 }))).toBe(true);
    expect(router.dispatch(event({ id: "a", sequence: 1 }))).toBe(false);
    expect(router.dispatch(event({ id: "b", sequence: 3 }))).toBe(true);
    expect(router.dispatch(event({ id: "c", sequence: 2 }))).toBe(false);
    expect(seen).toEqual([1, 3]);
  });

  it("reports a gap once for the channel that skipped", () => {
    const router = createEventRouter();
    const gaps: string[] = [];

    router.onGap((channel) => gaps.push(channel));
    router.dispatch(event({ sequence: 1 }));
    router.dispatch(event({ sequence: 4 }));
    router.dispatch(event({ sequence: 5 }));

    expect(gaps).toEqual(["match:1"]);
  });

  it("uses a version where there is no sequence, so an older snapshot cannot overwrite a newer one", () => {
    const router = createEventRouter();
    const versions: number[] = [];

    router.onType("ODDS_UPDATED", (e) => versions.push(e.version ?? -1));
    router.dispatch(event({ type: "ODDS_UPDATED", version: 7 }));
    router.dispatch(event({ type: "ODDS_UPDATED", version: 6 }));
    router.dispatch(event({ type: "ODDS_UPDATED", version: 8 }));

    expect(versions).toEqual([7, 8]);
  });

  it("flags a gap when the server acknowledges a later sequence than was delivered", () => {
    const router = createEventRouter();
    const gaps: string[] = [];

    router.onGap((channel) => gaps.push(channel));
    router.dispatch(event({ sequence: 2 }));
    router.acknowledge("match:1", 9);

    expect(gaps).toEqual(["match:1"]);
    expect(router.dispatch(event({ sequence: 9 }))).toBe(false);
    expect(router.dispatch(event({ sequence: 10 }))).toBe(true);
  });
});

describe("connection manager", () => {
  it("walks connecting, connected, reconnecting, failed and back", () => {
    const { transport, connections } = fakeTransport();
    const statuses: string[] = [];
    const manager = createConnectionManager({
      transport,
      url: () => "ws://x/live",
      channels: () => [],
      onOpen: () => undefined,
      onMessage: () => undefined,
      failAfterAttempts: 2,
      random: () => 1,
    });

    manager.onStatus((s) => statuses.push(s));
    manager.connect();
    connections[0]?.handlers.onOpen();
    connections[0]?.handlers.onClose();
    vi.advanceTimersByTime(1_000);
    connections[1]?.handlers.onClose();
    vi.advanceTimersByTime(2_000);
    connections[2]?.handlers.onOpen();

    expect(statuses).toEqual(["CONNECTING", "CONNECTED", "RECONNECTING", "FAILED", "CONNECTED"]);
    expect(manager.lastConnectedAt()).toBeTypeOf("number");
  });

  it("stops retrying once closed", () => {
    const { transport, connections } = fakeTransport();
    const manager = createConnectionManager({
      transport,
      url: () => "ws://x/live",
      channels: () => [],
      onOpen: () => undefined,
      onMessage: () => undefined,
      random: () => 1,
    });

    manager.connect();
    connections[0]?.handlers.onClose();
    manager.close();
    vi.advanceTimersByTime(60_000);

    expect(connections).toHaveLength(1);
    expect(manager.status()).toBe("DISCONNECTED");
  });
});

describe("realtime client", () => {
  it("resubscribes every wanted channel after a reconnect and answers pings", () => {
    const { transport, connections } = fakeTransport();
    const client = createRealtimeClient({ url: "ws://x/live", transport, random: () => 0 });

    client.subscribe("match:1", () => undefined);
    client.connect();
    connections[0]?.handlers.onOpen();
    client.subscribe("match:2", () => undefined);
    connections[0]?.handlers.onMessage(JSON.stringify({ type: "PING" }));

    expect(connections[0]?.sent).toEqual([
      { type: "SUBSCRIBE", channel: "match:1" },
      { type: "SUBSCRIBE", channel: "match:2" },
      { type: "PONG" },
    ]);

    connections[0]?.handlers.onClose();
    vi.advanceTimersByTime(1);
    connections[1]?.handlers.onOpen();

    expect(connections[1]?.sent).toEqual([
      { type: "SUBSCRIBE", channel: "match:1" },
      { type: "SUBSCRIBE", channel: "match:2" },
    ]);
  });

  it("delivers each event once, in order, only to its channel, and asks for a resync on a gap", () => {
    const { transport, connections } = fakeTransport();
    const client = createRealtimeClient({ url: "ws://x/live", transport });
    const got: number[] = [];
    const desynced: string[] = [];

    client.subscribe("match:1", (e) => got.push(e.sequence ?? -1));
    client.onDesync((channel) => desynced.push(channel));
    client.connect();
    connections[0]?.handlers.onOpen();

    const send = (data: string): void => connections[0]?.handlers.onMessage(data);

    send(frame("match:1", { type: "GOAL", sequence: 1 }));
    send(frame("match:1", { type: "GOAL", sequence: 1 }));
    send(frame("match:9", { type: "GOAL", sequence: 1 }));
    send(frame("match:1", { type: "CORNER", sequence: 2 }));
    send(frame("match:1", { type: "GOAL", sequence: 5 }));
    send("not json");

    expect(got).toEqual([1, 2, 5]);
    expect(desynced).toEqual(["match:1"]);
  });

  it("releases a channel when its last listener leaves", () => {
    const { transport, connections } = fakeTransport();
    const client = createRealtimeClient({ url: "ws://x/live", transport });

    client.connect();
    connections[0]?.handlers.onOpen();

    const a = client.subscribe("match:1", () => undefined);
    const b = client.subscribe("match:1", () => undefined);

    a();
    a();
    b();

    expect(connections[0]?.sent).toEqual([
      { type: "SUBSCRIBE", channel: "match:1" },
      { type: "UNSUBSCRIBE", channel: "match:1" },
    ]);
  });

  it("authenticates by frame or by query, and reports a rejected session", () => {
    const framed = fakeTransport();
    const onUnauthorized = vi.fn();
    const byFrame = createRealtimeClient({
      url: "ws://x/live",
      transport: framed.transport,
      authMode: "frame",
      getToken: () => "tok",
      onUnauthorized,
    });

    byFrame.connect();
    framed.connections[0]?.handlers.onOpen();
    framed.connections[0]?.handlers.onMessage(JSON.stringify({ type: "ERROR", code: "SESSION_EXPIRED", message: "" }));

    expect(framed.connections[0]?.sent[0]).toEqual({ type: "AUTH", token: "tok" });
    expect(onUnauthorized).toHaveBeenCalledOnce();

    const queried = fakeTransport();

    createRealtimeClient({ url: "ws://x/live", transport: queried.transport, authMode: "query", getToken: () => "tok" }).connect();

    expect(queried.connections[0]?.url).toBe("ws://x/live?access_token=tok");
  });

  it("replaces the connection for a renewed session", () => {
    const { transport, connections } = fakeTransport();
    const client = createRealtimeClient({ url: "ws://x/live", transport });

    client.connect();
    connections[0]?.handlers.onOpen();
    client.replaceConnection();

    expect(connections[0]?.closed).toBe(true);
    expect(connections).toHaveLength(2);
  });

  it("reopens a one-way transport when the channel list changes", () => {
    const { transport, connections } = fakeTransport(false);
    const client = createRealtimeClient({ url: "https://x/events", transport });

    client.subscribe("match:1", () => undefined);
    client.connect();
    connections[0]?.handlers.onOpen();
    client.subscribe("match:2", () => undefined);

    expect(connections[0]?.sent).toEqual([]);
    expect(connections[1]?.channels).toEqual(["match:1", "match:2"]);
  });
});
