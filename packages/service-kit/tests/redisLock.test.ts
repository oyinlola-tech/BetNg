import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRedisConnection, RedisLockLostError, withRedisLock } from "../src/index.js";
import type { RedisConnection } from "../src/index.js";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:56379";
const prefix = `locktest:${crypto.randomUUID()}`;
let redis: RedisConnection;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
  redis = createRedisConnection(REDIS_URL);
  await redis.connect();
});

afterAll(async () => {
  for (const key of await redis.client.keys(`${prefix}:*`)) await redis.client.del(key);
  await redis.close();
});

describe("withRedisLock", () => {
  it("keeps renewing the lock while a task outlives its TTL, then releases it", async () => {
    const key = `${prefix}:long`;
    let contender: Awaited<ReturnType<typeof withRedisLock>> | undefined;

    const held = await withRedisLock(redis, key, { ttlMs: 300 }, async (signal) => {
      await sleep(900);
      contender = await withRedisLock(redis, key, { ttlMs: 300 }, async () => "stolen");

      return signal.aborted ? "aborted" : "done";
    });

    expect(held).toEqual({ acquired: true, value: "done" });
    expect(contender).toEqual({ acquired: false });
    expect(await redis.client.exists(key)).toBe(0);
  });

  it("aborts the task when another holder owns the key, and never deletes that holder's lock", async () => {
    const key = `${prefix}:stolen`;
    let reason: unknown;

    const held = await withRedisLock(redis, key, { ttlMs: 300 }, async (signal) => {
      await redis.client.set(key, "someone-else", { expiration: { type: "PX", value: 5000 } });
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      reason = signal.reason;

      return "stopped";
    });

    expect(held).toEqual({ acquired: true, value: "stopped" });
    expect(reason).toBeInstanceOf(RedisLockLostError);
    expect(await redis.client.get(key)).toBe("someone-else");
  });

  it("aborts the task when a renewal fails", async () => {
    const key = `${prefix}:failing`;
    let extensions = 0;
    const client = new Proxy(redis.client, {
      get(target, property, receiver) {
        if (property === "eval") {
          return async (script: string, options: unknown) => {
            if (script.includes("pexpire")) {
              extensions += 1;
              throw new Error("connection reset");
            }

            return (target.eval as (s: string, o: unknown) => Promise<unknown>).call(target, script, options);
          };
        }

        const value: unknown = Reflect.get(target, property, receiver);

        return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
      },
    });
    const flaky = { ...redis, client } as RedisConnection;

    const held = await withRedisLock(flaky, key, { ttlMs: 150 }, async (signal) => {
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));

      return (signal.reason as Error).name;
    });

    expect(held).toEqual({ acquired: true, value: "RedisLockLostError" });
    expect(extensions).toBe(1);
    expect(await redis.client.exists(key)).toBe(0);
  });

  it("still accepts a task that ignores the signal and reports a held lock as not acquired", async () => {
    const key = `${prefix}:plain`;

    await redis.client.set(key, "other", { expiration: { type: "PX", value: 5000 } });

    expect(await withRedisLock(redis, key, { ttlMs: 200, waitMs: 50, retryEveryMs: 10 }, async () => 1)).toEqual({ acquired: false });

    await redis.client.del(key);

    expect(await withRedisLock(redis, key, { ttlMs: 200 }, async () => 2)).toEqual({ acquired: true, value: 2 });
  });
});
