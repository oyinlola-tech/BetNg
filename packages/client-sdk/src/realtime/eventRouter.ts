import type { RealtimeEvent, RealtimeEventType } from "./realtime.type.js";

export type RealtimeListener = (event: RealtimeEvent) => void;

export interface EventRouter {
  readonly onChannel: (channel: string, listener: RealtimeListener) => () => void;
  readonly onType: (type: RealtimeEventType, listener: RealtimeListener) => () => void;
  readonly onGap: (listener: (channel: string) => void) => () => void;
  /** False when the event was a duplicate or older than what the channel has already delivered. */
  readonly dispatch: (event: RealtimeEvent) => boolean;
  /** The server's latest sequence for a channel, from a subscription acknowledgement. */
  readonly acknowledge: (channel: string, lastSequence: number) => void;
  readonly forget: (channel: string) => void;
}

const SEEN_LIMIT = 2_000;

export function createEventRouter(): EventRouter {
  const byChannel = new Map<string, Set<RealtimeListener>>();
  const byType = new Map<RealtimeEventType, Set<RealtimeListener>>();
  const gapListeners = new Set<(channel: string) => void>();
  const sequences = new Map<string, number>();
  const versions = new Map<string, number>();
  const seen = new Set<string>();

  function register<K>(map: Map<K, Set<RealtimeListener>>, key: K, listener: RealtimeListener): () => void {
    const set = map.get(key) ?? new Set<RealtimeListener>();

    set.add(listener);
    map.set(key, set);

    return () => {
      set.delete(listener);
      if (set.size === 0) map.delete(key);
    };
  }

  function remember(id: string): boolean {
    if (seen.has(id)) return false;

    seen.add(id);

    if (seen.size > SEEN_LIMIT) {
      const oldest = seen.values().next().value;

      if (oldest !== undefined) seen.delete(oldest);
    }

    return true;
  }

  function gap(channel: string): void {
    for (const listener of gapListeners) listener(channel);
  }

  return {
    onChannel: (channel, listener) => register(byChannel, channel, listener),
    onType: (type, listener) => register(byType, type, listener),
    onGap: (listener) => {
      gapListeners.add(listener);

      return () => {
        gapListeners.delete(listener);
      };
    },
    dispatch: (event) => {
      if (event.id !== undefined && !remember(event.id)) return false;

      if (event.sequence !== undefined) {
        const last = sequences.get(event.channel) ?? 0;

        if (event.sequence <= last) return false;
        if (last > 0 && event.sequence > last + 1) gap(event.channel);

        sequences.set(event.channel, event.sequence);
      } else if (event.version !== undefined) {
        const key = `${event.channel}:${event.type}`;
        const last = versions.get(key) ?? 0;

        if (event.version <= last) return false;

        versions.set(key, event.version);
      }

      for (const listener of byChannel.get(event.channel) ?? []) listener(event);
      for (const listener of byType.get(event.type) ?? []) listener(event);

      return true;
    },
    acknowledge: (channel, lastSequence) => {
      const last = sequences.get(channel);

      if (last !== undefined && lastSequence > last) gap(channel);
      if (last === undefined || lastSequence > last) sequences.set(channel, lastSequence);
    },
    forget: (channel) => {
      sequences.delete(channel);

      for (const key of versions.keys()) {
        if (key.startsWith(`${channel}:`)) versions.delete(key);
      }
    },
  };
}
