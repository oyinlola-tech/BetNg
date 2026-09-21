// Fails open when Redis is down: identity enforces its own per-account lockout.

import { tooManyRequests } from "@betng/service-kit";
import { ErrorCodes } from "@betng/contracts";
import type { Logger, RedisConnection } from "@betng/service-kit";
import type { RateLimiter } from "../interfaces/index.js";

export function createRateLimiter(redis: RedisConnection | undefined, logger: Logger): RateLimiter {
  let warned = false;

  return {
    hit: async (key, rule) => {
      if (redis === undefined || rule.limit === 0) return;

      let count: number;
      let ttl: number;

      try {
        await redis.connect();

        const redisKey = `gateway:rate:${key}`;

        count = await redis.client.incr(redisKey);

        if (count === 1) await redis.client.expire(redisKey, rule.windowSeconds);

        ttl = await redis.client.ttl(redisKey);
      } catch (error) {
        if (!warned) {
          warned = true;
          logger.warn("Rate limiting is off: Redis cannot be reached", {
            error: error instanceof Error ? error.message : String(error),
          });
        }

        return;
      }

      warned = false;

      if (count > rule.limit) {
        throw tooManyRequests("Too many attempts. Wait a moment and try again.", {
          code: ErrorCodes.RATE_LIMITED,
          expose: true,
          headers: { "retry-after": String(ttl > 0 ? ttl : rule.windowSeconds) },
        });
      }
    },
  };
}
