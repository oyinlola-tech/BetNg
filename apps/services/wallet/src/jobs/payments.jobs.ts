import { randomUUID } from "node:crypto";
import type { Logger } from "@betng/service-kit";
import type { RekeyReport } from "../security/rekey.js";
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
  /** Present only while a key rotation is in progress, i.e. retired keys are configured. */
  readonly rekey?: () => Promise<RekeyReport>;
}

/** Deposit expiry, withdrawal dispatch and polling, webhook replay, reconciliation, queued statements and key rotation. Every step is idempotent, so two instances only duplicate reads. */
export function createWalletJobs(options: WalletJobsOptions): WalletJobs {
  let timer: NodeJS.Timeout | undefined;
  let running = false;
  let rotationDone = false;

  async function rotateKeys(rekey: () => Promise<RekeyReport>, requestId: string): Promise<void> {
    if (rotationDone) {
      return;
    }

    const report = await rekey();

    if (report.failed.length > 0) {
      // Retired keys must stay configured until these rows are resolved by hand.
      options.logger.error("Encrypted rows open under no configured key", {
        requestId,
        event: "wallet_rekey_unreadable",
        rows: report.failed.slice(0, 20),
        count: report.failed.length,
      });
    }

    if (report.rewritten > 0) {
      options.logger.info("Encrypted rows moved to the active key", { requestId, event: "wallet_rekey_progress", rewritten: report.rewritten, remaining: report.remaining });
    }

    if (report.remaining === 0) {
      rotationDone = true;
      options.logger.info("Every encrypted row is on the active key; the retired keys can be removed", { requestId, event: "wallet_rekey_complete" });
    }
  }

  async function runOnce(now: Date = new Date()): Promise<void> {
    if (running) {
      return;
    }

    running = true;

    const requestId = `job-${randomUUID()}`;

    try {
      await options.payments.expireDeposits(now, requestId);
      await options.payments.pollWithdrawals(requestId);
      await options.payments.retryWebhooks(now, requestId);
      await options.payments.reconcile(now, requestId);
      await options.statements.runQueued(requestId);

      // Nothing else will surface these: the provider has stopped re-delivering and
      // the money moved on their side. They need a person.
      const abandoned = await options.payments.abandonedWebhooks();

      if (abandoned > 0) {
        options.logger.error("Webhooks are waiting for an operator", {
          requestId,
          event: "webhook_dead_letter_waiting",
          abandoned,
        });
      }

      if (options.rekey !== undefined) {
        await rotateKeys(options.rekey, requestId);
      }
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
