// Fail-open limits (reads, the global per-IP limit) let traffic through while Redis is down and warn once;
// fail-closed limits (money, KYC) answer 503. A short breaker stops every request waiting on a dead Redis.

import { ErrorCodes } from "@betng/contracts";
import { serviceUnavailable, tooManyRequests } from "@betng/service-kit";
import type { Logger, RedisConnection } from "@betng/service-kit";
import type { RateLimiter } from "../interfaces/index.js";

const BREAKER_MS = 2000;

export interface RateLimiterOptions {
  readonly prefix: string;
  readonly now?: () => number;
}

export function createRateLimiter(
  redis: RedisConnection | undefined,
  logger: Logger,
  options: RateLimiterOptions,
): RateLimiter {
  const now = options.now ?? Date.now;
  let warned = false;
  let downUntil = 0;

  async function count(key: string, windowSeconds: number): Promise<{ count: number; ttl: number } | undefined> {
    if (redis === undefined || now() < downUntil) return undefined;

    try {
      await redis.connect();

      const redisKey = `${options.prefix}:rate:${key}`;
      const [hits, , ttl] = (await redis.client
        .multi()
        .incr(redisKey)
        .expire(redisKey, windowSeconds, "NX")
        .ttl(redisKey)
        .exec()) as unknown as [number, number, number];

      warned = false;

      return { count: Number(hits), ttl: Number(ttl) };
    } catch (error) {
      downUntil = now() + BREAKER_MS;

      if (!warned) {
        warned = true;
        logger.warn("Rate limiting cannot reach Redis", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return undefined;
    }
  }

  return {
    hit: async (key, rule, hitOptions = {}) => {
      if (rule.limit === 0) return;

      const result = await count(key, rule.windowSeconds);

      if (result === undefined) {
        if (hitOptions.failClosed === true) {
          throw serviceUnavailable("This action is temporarily unavailable. Nothing was changed; try again shortly.", {
            code: ErrorCodes.SERVICE_UNAVAILABLE,
            expose: true,
            headers: { "retry-after": "5" },
          });
        }

        return;
      }

      if (result.count > rule.limit) {
        throw tooManyRequests("Too many requests. Wait a moment and try again.", {
          code: ErrorCodes.RATE_LIMITED,
          expose: true,
          headers: { "retry-after": String(result.ttl > 0 ? result.ttl : rule.windowSeconds) },
        });
      }
    },
  };
}
