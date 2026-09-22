import { randomUUID } from "node:crypto";
import type { Logger } from "@betng/service-kit";
import type { PaymentsService } from "../services/payments/payments.service.js";
import type { StatementsService } from "../services/statements/statements.service.js";

export interface WalletJobs {
  runOnce(now?: Date): Promise<void>;
  start(): void;
  stop(): void;
}

export interface WalletJobsOptions {
  readonly payments: PaymentsService;
  readonly statements: StatementsService;
  readonly logger: Logger;
  readonly intervalMs: number;
}

/** Deposit expiry, withdrawal dispatch and polling, and queued statements. Every step is idempotent, so two instances only duplicate reads. */
export function createWalletJobs(options: WalletJobsOptions): WalletJobs {
  let timer: NodeJS.Timeout | undefined;
  let running = false;

  async function runOnce(now: Date = new Date()): Promise<void> {
    if (running) {
      return;
    }

    running = true;

    const requestId = `job-${randomUUID()}`;

    try {
      await options.payments.expireDeposits(now, requestId);
      await options.payments.pollWithdrawals(requestId);
      await options.statements.runQueued(requestId);
    } catch (error) {
      options.logger.error("Wallet job run failed", { requestId, event: "wallet_jobs_failed", error: error instanceof Error ? error.name : "unknown" });
    } finally {
      running = false;
    }
  }

  return {
    runOnce,
    start: () => {
      if (timer !== undefined) {
        return;
      }

      timer = setInterval(() => {
        void runOnce();
      }, options.intervalMs);
      timer.unref();
    },
    stop: () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    },
  };
}
