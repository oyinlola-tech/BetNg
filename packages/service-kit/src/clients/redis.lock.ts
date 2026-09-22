import type { RedisConnection } from "./redis.client.js";

const RELEASE = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

const EXTEND = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end`;

export interface RedisLockOptions {
  readonly ttlMs: number;
  readonly waitMs?: number;
  readonly retryEveryMs?: number;
}

export class RedisLockLostError extends Error {
  public constructor(key: string, cause?: unknown) {
    super(`The Redis lock "${key}" could not be renewed; another holder may take it.`, cause === undefined ? undefined : { cause });
    this.name = "RedisLockLostError";
  }
}

/**
 * Runs `task` while holding `key`. The expiry is extended every ttl/3 with a token-checked PEXPIRE, so a long task keeps the
 * lock; if an extension fails or finds another holder, `signal` aborts and the task should stop. Release is token-checked too.
 */
export async function withRedisLock<T>(
  connection: RedisConnection,
  key: string,
  options: RedisLockOptions,
  task: (signal: AbortSignal) => Promise<T>,
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

  const lost = new AbortController();
  const everyMs = Math.max(1, Math.floor(options.ttlMs / 3));
  let timer: ReturnType<typeof setTimeout> | undefined;
  let renewing: Promise<void> = Promise.resolve();
  let stopped = false;

  const renew = async (): Promise<void> => {
    try {
      const extended = await connection.client.eval(EXTEND, { keys: [key], arguments: [token, String(options.ttlMs)] });

      if (extended !== 1) lost.abort(new RedisLockLostError(key));
    } catch (error) {
      lost.abort(new RedisLockLostError(key, error));
    }
  };

  const schedule = (): void => {
    timer = setTimeout(() => {
      renewing = renew().then(() => {
        if (!stopped && !lost.signal.aborted) schedule();
      });
    }, everyMs);
    timer.unref();
  };

  schedule();

  try {
    return { acquired: true, value: await task(lost.signal) };
  } finally {
    stopped = true;
    clearTimeout(timer);
    await renewing;
    await connection.client.eval(RELEASE, { keys: [key], arguments: [token] });
  }
}
