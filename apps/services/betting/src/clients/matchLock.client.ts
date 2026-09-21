/**
 * The per-match placement lock, on Redis.
 *
 * Locks are taken in sorted order so two multi-match slips can never hold one
 * lock each and wait for the other's. Redis is coordination only: losing it
 * stops placement, it never loses a bet.
 */

import { withRedisLock } from "@betng/service-kit";
import type { Logger, RedisConnection } from "@betng/service-kit";
import { MATCH_LOCK } from "../constants/index.js";
import type { MatchLock, MatchLockResult } from "../interfaces/index.js";

type TaskOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: unknown };

export function createRedisMatchLock(
  connection: RedisConnection,
  logger: Logger,
): MatchLock {
  return {
    withMatches: async <T>(
      matchIds: readonly string[],
      task: () => Promise<T>,
    ): Promise<MatchLockResult<T>> => {
      const keys = [...new Set(matchIds)]
        .sort()
        .map((id) => `${MATCH_LOCK.keyPrefix}${id}`);
      const deadline = Date.now() + MATCH_LOCK.waitMs;

      // The task's outcome is captured, so whatever `withRedisLock` throws is Redis, not the placement.
      const box: { outcome?: TaskOutcome<T> } = {};

      const run = async (): Promise<void> => {
        try {
          box.outcome = { ok: true, value: await task() };
        } catch (error) {
          box.outcome = { ok: false, error };
        }
      };

      const acquire = async (index: number): Promise<boolean> => {
        const key = keys[index];

        if (key === undefined) {
          await run();
          return true;
        }

        const held = await withRedisLock(
          connection,
          key,
          {
            ttlMs: MATCH_LOCK.ttlMs,
            waitMs: Math.max(0, deadline - Date.now()),
            retryEveryMs: MATCH_LOCK.retryEveryMs,
          },
          async () => acquire(index + 1),
        );

        return held.acquired && held.value;
      };

      try {
        await acquire(0);
      } catch (error) {
        logger.error("Match lock failed", {
          event: "match_lock_failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const settled = box.outcome;

      if (settled === undefined) {
        return { acquired: false };
      }

      if (!settled.ok) {
        throw settled.error;
      }

      return { acquired: true, value: settled.value };
    },
  };
}
