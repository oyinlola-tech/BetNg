import type { Logger } from "@betng/service-kit";
import { SIGNAL_RETRY } from "../constants/index.js";
import type { EventPeer, SettlementNotifier } from "../interfaces/index.js";
import type { SettlementRecord } from "../models/index.js";

export function betSignalChannels(settlement: SettlementRecord): readonly string[] {
  if (settlement.channel !== "ONLINE" || settlement.userId === null) return [];

  return [`user:${settlement.userId}`, `bets:${settlement.userId}`];
}

export interface SignalRetryOptions {
  /** Waits before each retry, so the attempt count is one more than its length. */
  readonly delaysMs?: readonly number[];
  readonly random?: () => number;
}

/**
 * "Re-read your bets" signals carrying only the bet id, published beside settlement with a short backoff retry.
 * idle() skips the remaining waits and resolves once every signal has succeeded or given up.
 */
export function withBetSignals(
  notifier: SettlementNotifier,
  event: EventPeer | undefined,
  logger: Logger,
  options: SignalRetryOptions = {},
): SettlementNotifier {
  if (event === undefined) return notifier;

  const delaysMs = options.delaysMs ?? SIGNAL_RETRY.DELAYS_MS;
  const random = options.random ?? Math.random;
  const pending = new Set<Promise<void>>();
  const sleepers = new Set<() => void>();
  let draining = 0;

  const pause = async (baseMs: number): Promise<void> => {
    if (draining > 0) return;

    await new Promise<void>((resolve) => {
      const wake = (): void => {
        clearTimeout(timer);
        sleepers.delete(wake);
        resolve();
      };
      const timer = setTimeout(wake, baseMs * (1 - SIGNAL_RETRY.JITTER + random() * 2 * SIGNAL_RETRY.JITTER));

      timer.unref();
      sleepers.add(wake);
    });
  };

  const deliver = async (channel: string, settlement: SettlementRecord, requestId: string): Promise<void> => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await event.publishSignal(channel, "BET_SETTLED", requestId, settlement.betId);

        return;
      } catch {
        const delay = delaysMs[attempt - 1];

        if (delay === undefined || pending.size > SIGNAL_RETRY.MAX_PENDING) {
          logger.warn("Realtime signal was not published", {
            requestId,
            event: "signal_not_published",
            betId: settlement.betId,
            settlementId: settlement.id,
            attempts: attempt,
          });

          return;
        }

        await pause(delay);
      }
    }
  };

  const publish = (channel: string, settlement: SettlementRecord, requestId: string): void => {
    const run: Promise<void> = deliver(channel, settlement, requestId)
      .catch(() => undefined)
      .finally(() => pending.delete(run));

    pending.add(run);
  };

  return {
    settled: (settlement, requestId) => {
      notifier.settled(settlement, requestId);

      try {
        for (const channel of betSignalChannels(settlement)) publish(channel, settlement, requestId);
      } catch {
        logger.warn("Realtime signal could not be prepared", { requestId, betId: settlement.betId });
      }
    },
    idle: async () => {
      draining += 1;

      try {
        for (const wake of [...sleepers]) wake();
        while (pending.size > 0) await Promise.all([...pending]);
        await notifier.idle();
      } finally {
        draining -= 1;
      }
    },
  };
}
