import { withRedisLock } from "@betng/service-kit";
import type { Logger, RedisConnection } from "@betng/service-kit";
import { SCHEDULER } from "../constants/index.js";

export interface SchedulerJob {
  start(): void;
  stop(): Promise<void>;
  runOnce(): Promise<boolean>;
}

export interface SchedulerOptions {
  readonly redis: RedisConnection;
  readonly tick: () => Promise<void>;
  readonly logger: Logger;
  readonly intervalMs?: number;
}

/**
 * Ticks under `lock:match:scheduler` so only one instance drives the lifecycle. Without Redis the tick is skipped,
 * never run unlocked: the database guards make a double tick harmless, but peers would be called twice.
 */
export function createSchedulerJob(options: SchedulerOptions): SchedulerJob {
  const { redis, tick, logger } = options;
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<boolean> | undefined;
  let redisWasDown = false;

  async function guardedTick(): Promise<boolean> {
    try {
      const outcome = await withRedisLock(
        redis,
        SCHEDULER.LOCK_KEY,
        { ttlMs: SCHEDULER.LOCK_TTL_MS },
        tick,
      );

      if (redisWasDown)
        logger.info("Scheduler lock available again", {
          event: "match.schedulerResumed",
        });

      redisWasDown = false;

      return outcome.acquired;
    } catch (error) {
      if (!redisWasDown) {
        logger.error(
          "Scheduler tick skipped: the Redis lock could not be taken",
          {
            event: "match.schedulerSkipped",
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }

      redisWasDown = true;

      return false;
    }
  }

  function runOnce(): Promise<boolean> {
    running ??= guardedTick().finally(() => {
      running = undefined;
    });

    return running;
  }

  return {
    runOnce,

    start: () => {
      if (timer !== undefined) return;

      timer = setInterval(() => {
        if (running === undefined) void runOnce();
      }, options.intervalMs ?? SCHEDULER.TICK_MS);

      logger.info("Scheduler started", { event: "match.schedulerStarted" });
    },

    stop: async () => {
      if (timer !== undefined) clearInterval(timer);

      timer = undefined;
      await running;
      logger.info("Scheduler stopped", { event: "match.schedulerStopped" });
    },
  };
}
