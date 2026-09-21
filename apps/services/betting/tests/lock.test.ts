import { afterAll, describe, expect, it } from "vitest";
import { createRedisConnection, createServiceLogger } from "@betng/service-kit";
import { createRedisMatchLock } from "../src/clients/index.js";
import { loadBettingConfig } from "../src/index.js";

const config = await loadBettingConfig({
  NODE_ENV: "test",
  LOG_LEVEL: "fatal",
  BETTING_DATABASE_URL: "postgresql://unused@localhost/unused?schema=betting",
  REDIS_URL: process.env["REDIS_URL"] ?? "redis://localhost:56379",
});
const logger = createServiceLogger(config);
const redis = createRedisConnection(config.redisUrl ?? "");

afterAll(async () => {
  await redis.close();
});

describe("match lock", () => {
  it("serialises two slips that share a match, whatever order they name them in", async () => {
    const lock = createRedisMatchLock(redis, logger);
    const [a, b] = [crypto.randomUUID(), crypto.randomUUID()];
    const events: string[] = [];

    const slip = async (name: string, ids: string[]): Promise<void> => {
      await lock.withMatches(ids, async () => {
        events.push(`${name}:in`);
        await new Promise((resolve) => setTimeout(resolve, 80));
        events.push(`${name}:out`);
      });
    };

    await Promise.all([slip("one", [a, b]), slip("two", [b, a])]);

    expect(events).toHaveLength(4);
    expect(events[0]?.split(":")[0]).toBe(events[1]?.split(":")[0]);
    expect(events[2]?.split(":")[0]).toBe(events[3]?.split(":")[0]);
  });

  it("passes the task's own failure through and releases the lock", async () => {
    const lock = createRedisMatchLock(redis, logger);
    const id = crypto.randomUUID();

    await expect(
      lock.withMatches([id], async () => Promise.reject(new Error("placement failed"))),
    ).rejects.toThrow("placement failed");

    expect(await lock.withMatches([id], async () => Promise.resolve("ran"))).toEqual({
      acquired: true,
      value: "ran",
    });
  });

  it("does not run the task when Redis cannot be reached", async () => {
    const unreachable = createRedisConnection("redis://127.0.0.1:1");
    const lock = createRedisMatchLock(unreachable, logger);
    let ran = false;

    const result = await lock.withMatches([crypto.randomUUID()], async () => {
      ran = true;
      return Promise.resolve();
    });

    expect(result).toEqual({ acquired: false });
    expect(ran).toBe(false);
  });
});
