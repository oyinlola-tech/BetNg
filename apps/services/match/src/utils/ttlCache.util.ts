export interface TtlCache<T> {
  /** A failed load is not kept, so the next caller tries again. */
  get(key: string, load: () => Promise<T>): Promise<T>;
}

export function createTtlCache<T>(options: {
  readonly ttlMs: number;
  readonly maxEntries: number;
  readonly now: () => number;
}): TtlCache<T> {
  const entries = new Map<
    string,
    { readonly expiresAt: number; readonly value: Promise<T> }
  >();

  const evict = (now: number): void => {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) entries.delete(key);
    }

    for (const key of entries.keys()) {
      if (entries.size < options.maxEntries) break;
      entries.delete(key);
    }
  };

  return {
    get: async (key, load) => {
      const now = options.now();
      const cached = entries.get(key);

      if (cached !== undefined && cached.expiresAt > now) return cached.value;

      evict(now);

      const value = load();

      entries.set(key, { expiresAt: now + options.ttlMs, value });
      value.catch(() => {
        if (entries.get(key)?.value === value) entries.delete(key);
      });

      return value;
    },
  };
}
