/**
 * In-process implementation of {@link ChannelRegistry}.
 *
 * Subscriptions live in this process's memory, which means one event-service
 * instance serves a given subscriber for the life of its connection. That is
 * the right shape for the foundation: it is correct, it is observable, and it
 * makes the boundary that a Redis-backed registry will sit behind explicit.
 *
 * What it is *not* is a replay log. The service holds the last sequence per
 * channel, not the events themselves, because the stream is a projection —
 * a client that missed frames re-reads the match from the match service.
 * Keeping history here would create a second source of truth.
 */

import type {
  ChannelRegistry,
  ChannelState,
  WebSocketSession,
} from "../interfaces/index.js";

interface ChannelRecord {
  sequence: number;
  readonly subscribers: Set<WebSocketSession>;
}

/**
 * Creates the in-process channel registry.
 *
 * @param now - Supplies the current time. Injected so the heartbeat can be
 *   tested without waiting on the wall clock.
 * @returns A registry backed by process memory.
 */
export function createInMemoryChannelRegistry(
  now: () => number = () => Date.now(),
): ChannelRegistry {
  const channels = new Map<string, ChannelRecord>();
  const subscriptions = new Map<WebSocketSession, Set<string>>();
  const lastSeen = new Map<WebSocketSession, number>();

  function record(channel: string): ChannelRecord {
    const existing = channels.get(channel);

    if (existing !== undefined) {
      return existing;
    }

    const created: ChannelRecord = { sequence: 0, subscribers: new Set() };
    channels.set(channel, created);

    return created;
  }

  function snapshot(channel: string, entry: ChannelRecord): ChannelState {
    return {
      channel,
      lastSequence: entry.sequence,
      subscribers: entry.subscribers.size,
    };
  }

  return {
    open: (session) => {
      subscriptions.set(session, new Set());
      lastSeen.set(session, now());
    },

    close: (session) => {
      for (const channel of subscriptions.get(session) ?? []) {
        const entry = channels.get(channel);
        entry?.subscribers.delete(session);

        // A channel nobody listens to still holds its sequence: a late
        // subscriber must not see the count restart at 1 mid-match.
      }

      subscriptions.delete(session);
      lastSeen.delete(session);
    },

    subscribe: (session, channel) => {
      const entry = record(channel);
      entry.subscribers.add(session);
      subscriptions.get(session)?.add(channel);

      return snapshot(channel, entry);
    },

    unsubscribe: (session, channel) => {
      channels.get(channel)?.subscribers.delete(session);
      subscriptions.get(session)?.delete(channel);
    },

    subscribers: (channel) => [...(channels.get(channel)?.subscribers ?? [])],

    state: (channel) => snapshot(channel, record(channel)),

    nextSequence: (channel) => {
      const entry = record(channel);
      entry.sequence += 1;

      return entry.sequence;
    },

    markAlive: (session) => {
      lastSeen.set(session, now());
    },

    stale: (timeoutMs) => {
      const deadline = now() - timeoutMs;

      return [...lastSeen.entries()]
        .filter(([, seen]) => seen < deadline)
        .map(([session]) => session);
    },

    connections: () => [...subscriptions.keys()],
  };
}
