import type { ConnectionState } from "@betng/ui-core";

/** Read-only public data only. Wallet, bets, payments and every command are never cached or replayed. */
export type CacheableKind = "fixtures" | "standings" | "results";

const CACHEABLE: readonly string[] = ["fixtures", "standings", "results"];
const PREFIX = "betng.offline.";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 40;
const MAX_BYTES = 256 * 1024;

export interface CacheStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface CachedValue<T> {
  readonly value: T;
  readonly savedAt: number;
}

export interface OfflineCache {
  read<T>(kind: CacheableKind, key: string): CachedValue<T> | undefined;
  write(kind: CacheableKind, key: string, value: unknown): void;
}

export function isCacheableKind(kind: string): kind is CacheableKind {
  return CACHEABLE.includes(kind);
}

/** Bet placement, deposits and withdrawals go to the platform live or not at all. */
export function canRunFinancialCommand(state: ConnectionState): boolean {
  return state !== "OFFLINE" && state !== "FAILED";
}

export const OFFLINE_COMMAND_MESSAGE = "You are offline. Connect to the internet to continue; nothing is queued or sent later.";

/** Errors after which a cached read may stand in for the platform. */
export function isConnectivityError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;

  return code === "NETWORK" || code === "OFFLINE" || code === "TIMEOUT" || code === "UNAVAILABLE";
}

function entryKey(kind: CacheableKind, key: string): string {
  return `${PREFIX}${kind}.${key.replace(/[^A-Za-z0-9_:.,-]/g, "_").slice(0, 120)}`;
}

export function createOfflineCache(store: CacheStore, now: () => number = Date.now): OfflineCache {
  const indexKey = `${PREFIX}index`;

  const readIndex = (): string[] => {
    try {
      const parsed: unknown = JSON.parse(store.get(indexKey) ?? "[]");

      return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string" && k.startsWith(PREFIX)) : [];
    } catch {
      return [];
    }
  };

  return {
    read: <T>(kind: CacheableKind, key: string): CachedValue<T> | undefined => {
      if (!isCacheableKind(kind)) return undefined;

      try {
        const raw = store.get(entryKey(kind, key));

        if (raw === null) return undefined;

        const entry = JSON.parse(raw) as CachedValue<T>;

        if (typeof entry.savedAt !== "number" || now() - entry.savedAt > MAX_AGE_MS) return undefined;

        return entry;
      } catch {
        return undefined;
      }
    },
    write: (kind, key, value) => {
      if (!isCacheableKind(kind)) return;

      let raw: string;

      try {
        raw = JSON.stringify({ value, savedAt: now() });
      } catch {
        return;
      }

      if (raw.length > MAX_BYTES) return;

      const id = entryKey(kind, key);
      const index = [...readIndex().filter((k) => k !== id), id];

      while (index.length > MAX_ENTRIES) {
        const evicted = index.shift();

        if (evicted !== undefined) store.remove(evicted);
      }

      store.set(id, raw);
      store.set(indexKey, JSON.stringify(index));
    },
  };
}
