import type { Logger } from "@betng/service-kit";
import { NOTIFICATION_DELIVERY, NOTIFICATION_KEY } from "../constants/index.js";
import type {
  CustomerNotification,
  IdentityPeer,
  SettlementNotifier,
} from "../interfaces/index.js";
import type { SettlementRecord } from "../models/index.js";
import { formatNaira, toSafeNumber } from "../utils/index.js";

function wording(settlement: SettlementRecord): { readonly title: string; readonly body: string } {
  const stake = formatNaira(settlement.stake);
  const payout = formatNaira(settlement.payout);

  switch (settlement.outcome) {
    case "WON":
      return {
        title: `You won ${payout}`,
        body: `Your ${stake} bet won. ${payout} has been added to your wallet.`,
      };
    case "VOID":
      return {
        title: `Bet refunded: ${payout}`,
        body: `Your ${stake} bet was voided. ${payout} has been returned to your wallet.`,
      };
    case "LOST":
      return { title: "Your bet lost", body: `Your ${stake} bet did not win this time.` };
  }
}

/** Shop tickets have no customer account, so only an online bet with a customer is announced. */
export function notificationFor(settlement: SettlementRecord): CustomerNotification | undefined {
  if (settlement.channel !== "ONLINE" || settlement.userId === null) {
    return undefined;
  }

  const matchId = settlement.legs[0]?.matchId;

  return {
    customerId: settlement.userId,
    kind: NOTIFICATION_DELIVERY.KIND,
    ...wording(settlement),
    data: {
      betId: settlement.betId,
      ...(matchId === undefined ? {} : { matchId }),
      outcome: settlement.outcome,
      payout: toSafeNumber(settlement.payout),
    },
    dedupeKey: NOTIFICATION_KEY.settlement(settlement.betId),
  };
}

interface Delivery {
  readonly notification: CustomerNotification;
  readonly settlementId: string;
  readonly requestId: string;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Deliveries run beside settlement with a small fixed concurrency, so a slow identity cannot hold a payout up. */
export function createSettlementNotifier(identity: IdentityPeer, logger: Logger): SettlementNotifier {
  const queue: Delivery[] = [];
  const waiters: (() => void)[] = [];
  let active = 0;

  const deliver = async (delivery: Delivery): Promise<void> => {
    const { notification, settlementId, requestId } = delivery;
    const log = { requestId, betId: notification.data.betId, settlementId };

    try {
      const result = await identity.notify(notification, requestId);

      logger.debug("Customer notified", { ...log, duplicate: result.duplicate });
    } catch (error) {
      logger.warn("Customer could not be notified", { ...log, error: describe(error) });
    }
  };

  const pump = (): void => {
    while (active < NOTIFICATION_DELIVERY.CONCURRENCY) {
      const next = queue.shift();

      if (next === undefined) {
        break;
      }

      active += 1;

      void deliver(next).finally(() => {
        active -= 1;
        pump();
      });
    }

    if (active === 0 && queue.length === 0) {
      for (const wake of waiters.splice(0)) {
        wake();
      }
    }
  };

  return {
    settled: (settlement, requestId) => {
      try {
        const notification = notificationFor(settlement);

        if (notification === undefined) {
          return;
        }

        if (queue.length >= NOTIFICATION_DELIVERY.MAX_QUEUED) {
          logger.warn("Notification queue is full; notification dropped", {
            requestId,
            betId: settlement.betId,
            settlementId: settlement.id,
          });

          return;
        }

        queue.push({ notification, settlementId: settlement.id, requestId });
        pump();
      } catch (error) {
        logger.warn("Customer notification could not be prepared", {
          requestId,
          betId: settlement.betId,
          settlementId: settlement.id,
          error: describe(error),
        });
      }
    },

    idle: async () =>
      active === 0 && queue.length === 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            waiters.push(resolve);
          }),
  };
}
