import type { Logger, RedisConnection } from "@betng/service-kit";
import { SCHEDULER } from "../constants/index.js";

export interface SchedulerJob {
  start(): void;
  stop(): Promise<void>;
  runOnce(): Promise<boolean>;
}

/** Answers false once the lock is lost, so a tick stops before its next step. */
export type LockHeld = () => boolean;

export interface SchedulerOptions {
  readonly redis: RedisConnection;
  readonly tick: (held: LockHeld) => Promise<void>;
  readonly logger: Logger;
  readonly intervalMs?: number;
  readonly lockTtlMs?: number;
}

const RELEASE = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
const RENEW = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end`;

/**
 * Ticks under `lock:match:scheduler` so only one instance drives the lifecycle. Without Redis the tick is skipped,
 * never run unlocked: the database guards make a double tick harmless, but peers would be called twice.
 * The lock is renewed while a tick runs, so a tick longer than the TTL never shares the lifecycle with another instance.
 */
export function createSchedulerJob(options: SchedulerOptions): SchedulerJob {
  const { redis, tick, logger } = options;
  const ttlMs = options.lockTtlMs ?? SCHEDULER.LOCK_TTL_MS;
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<boolean> | undefined;
  let redisWasDown = false;

  async function lockedTick(): Promise<boolean> {
    await redis.connect();

    const token = crypto.randomUUID();
    const taken = await redis.client.set(SCHEDULER.LOCK_KEY, token, {
      condition: "NX",
      expiration: { type: "PX", value: ttlMs },
    });

    if (taken !== "OK") return false;

    let held = true;
    let renewing: Promise<void> = Promise.resolve();

    const renew = async (): Promise<void> => {
      try {
        const renewed = await redis.client.eval(RENEW, {
          keys: [SCHEDULER.LOCK_KEY],
          arguments: [token, String(ttlMs)],
        });

        if (renewed !== 1 && held) {
          held = false;
          logger.error("Scheduler lock lost mid-tick; the tick stops", {
            event: "match.schedulerLockLost",
            alert: true,
          });
        }
      } catch (error) {
        held = false;
        logger.error("Scheduler lock could not be renewed; the tick stops", {
          event: "match.schedulerLockLost",
          alert: true,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    const heartbeat = setInterval(
      () => {
        renewing = renew();
      },
      Math.max(1, Math.floor(ttlMs / 3)),
    );

    heartbeat.unref();

    try {
      await tick(() => held);

      return true;
    } finally {
      clearInterval(heartbeat);
      await renewing;

      if (held) {
        await redis.client
          .eval(RELEASE, { keys: [SCHEDULER.LOCK_KEY], arguments: [token] })
          .catch(() => undefined);
      }
    }
  }

  async function guardedTick(): Promise<boolean> {
    try {
      const acquired = await lockedTick();

      if (redisWasDown)
        logger.info("Scheduler lock available again", {
          event: "match.schedulerResumed",
        });

      redisWasDown = false;

      return acquired;
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
        void runOnce();
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
