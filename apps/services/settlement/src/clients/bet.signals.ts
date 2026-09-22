import type { Logger } from "@betng/service-kit";
import type { EventPeer, SettlementNotifier } from "../interfaces/index.js";
import type { SettlementRecord } from "../models/index.js";

export function betSignalChannels(settlement: SettlementRecord): readonly string[] {
  if (settlement.channel !== "ONLINE" || settlement.userId === null) return [];

  return [`user:${settlement.userId}`, `bets:${settlement.userId}`];
}

/** "Re-read your bets" signals carrying only the bet id; fire and forget, so the event service cannot touch settlement. */
export function withBetSignals(notifier: SettlementNotifier, event: EventPeer | undefined, logger: Logger): SettlementNotifier {
  if (event === undefined) return notifier;

  const publish = (channel: string, settlement: SettlementRecord, requestId: string): void => {
    void event.publishSignal(channel, "BET_SETTLED", requestId, settlement.betId).catch(() => {
      logger.warn("Realtime signal was not published", {
        requestId,
        event: "signal_not_published",
        betId: settlement.betId,
        settlementId: settlement.id,
      });
    });
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
    idle: async () => notifier.idle(),
  };
}
