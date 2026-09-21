import type { CommandBus } from "@zudojs/cqrs";
import type { Logger } from "@betng/service-kit";
import { RollOverPeriodCommand } from "../services/operator/commands/index.js";
import { RetryEffectsCommand } from "../services/settlement/commands/index.js";
import type { RetryEffectsResult } from "../services/settlement/commands/index.js";

export interface MaintenanceJob {
  readonly tick: () => Promise<void>;
  readonly start: () => void;
  readonly stop: () => Promise<void>;
}

export interface MaintenanceJobOptions {
  readonly commandBus: CommandBus;
  readonly logger: Logger;
  readonly intervalMs: number;
}

export function createMaintenanceJob(options: MaintenanceJobOptions): MaintenanceJob {
  const { commandBus, logger } = options;

  let timer: NodeJS.Timeout | undefined;
  let running: Promise<void> | undefined;

  const pass = async (): Promise<void> => {
    const requestId = `maintenance-${crypto.randomUUID()}`;

    try {
      const retried = await commandBus.execute<RetryEffectsCommand, RetryEffectsResult>(
        new RetryEffectsCommand(requestId),
      );

      if (retried.attempted > 0) {
        logger.info("Settlement effects retried", { requestId, ...retried });
      }

      await commandBus.execute<RollOverPeriodCommand, boolean>(
        new RollOverPeriodCommand(new Date(), requestId),
      );
    } catch (error) {
      logger.error("Maintenance pass failed", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const tick = async (): Promise<void> => {
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
