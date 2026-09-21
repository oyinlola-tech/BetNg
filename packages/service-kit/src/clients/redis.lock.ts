/**
 * A short-lived distributed lock on Redis (`SET key token NX PX ttl`, released only by its holder).
 *
 * Used where two processes must not do the same thing at once: the match scheduler's tick and bet placement on
 * one match. It is coordination only: losing Redis loses the lock, never data, and PostgreSQL stays the authority.
 */

import type { RedisConnection } from "./redis.client.js";

const RELEASE = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

export interface RedisLockOptions {
  readonly ttlMs: number;
  /** How long to keep trying before giving up. 0 tries once. */
  readonly waitMs?: number;
  readonly retryEveryMs?: number;
}

/** Runs `task` while holding `key`. Resolves `undefined`, without running it, when the lock could not be taken. */
export async function withRedisLock<T>(
  connection: RedisConnection,
  key: string,
  options: RedisLockOptions,
  task: () => Promise<T>,
): Promise<{ readonly acquired: true; readonly value: T } | { readonly acquired: false }> {
  await connection.connect();

  const token = crypto.randomUUID();
  const deadline = Date.now() + (options.waitMs ?? 0);

  for (;;) {
    const taken = await connection.client.set(key, token, {
      condition: "NX",
      expiration: { type: "PX", value: options.ttlMs },
    });

    if (taken === "OK") break;

    if (Date.now() >= deadline) return { acquired: false };

    await new Promise((resolve) => setTimeout(resolve, options.retryEveryMs ?? 25));
  }

  try {
    return { acquired: true, value: await task() };
  } finally {
    await connection.client.eval(RELEASE, { keys: [key], arguments: [token] });
  }
}
