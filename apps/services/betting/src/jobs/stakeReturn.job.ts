import type { Logger } from "@betng/service-kit";
import type { StakeReturner, StakeReturnPass } from "../services/betting/stakeReturner.js";

export interface StakeReturnJob {
  readonly tick: () => Promise<StakeReturnPass | undefined>;
  readonly start: () => void;
  readonly stop: () => Promise<void>;
}

export interface StakeReturnJobOptions {
  readonly returner: StakeReturner;
  readonly logger: Logger;
  readonly intervalMs: number;
}

export function createStakeReturnJob(options: StakeReturnJobOptions): StakeReturnJob {
  const { returner, logger } = options;

  let timer: NodeJS.Timeout | undefined;
  let running: Promise<StakeReturnPass | undefined> | undefined;

  const pass = async (): Promise<StakeReturnPass | undefined> => {
    try {
      const result = await returner.drain();

      if (result.attempted > 0) {
        logger.info("Stake returns retried", { event: "stake_returns_retried", ...result });
      }

      return result;
    } catch (error) {
      logger.error("Stake return pass failed", {
        event: "stake_return_pass_failed",
        error: error instanceof Error ? error.message : String(error),
      });

      return undefined;
    }
  };

  const tick = async (): Promise<StakeReturnPass | undefined> => {
    running ??= pass().finally(() => {
      running = undefined;
    });

    return running;
  };

  return {
    tick,

    start: () => {
      if (timer !== undefined) {
        return;
      }

      timer = setInterval(() => {
        void tick();
      }, options.intervalMs);
      timer.unref();
    },

    stop: async () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }

      await running;
    },
  };
}
