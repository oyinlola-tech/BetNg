import { useEffect, useState } from "react";
import { dataSource, logger } from "../services/runtime";

export interface BetSettlementNotification {
  readonly betId: string;
  readonly kind: "BET_ACCEPTED" | "BET_SETTLED" | "BET_UPDATED";
}

/**
 * Subscribes to real-time bet settlement updates via WebSocket/SSE.
 * Uses the platform data source's subscribeBetSignals method.
 */
export function useBetSettlementSubscription(): void {
  useEffect(() => {
    if (!dataSource.subscribeBetSignals) return;

    const unsubscribe = dataSource.subscribeBetSignals((signal) => {
      logger.info("flow", "Bet signal received", {
        kind: signal.kind,
        betId: signal.betId,
      });

      const notification: BetSettlementNotification = {
        betId: signal.betId ?? "unknown",
        kind: signal.kind,
      };

      window.dispatchEvent(
        new CustomEvent("bet:signal", { detail: notification }),
      );
    });

    return () => {
      unsubscribe?.();
    };
  }, []);
}

/**
 * Listens for bet settlement events and returns the latest notification.
 */
export function useBetSignalListener(): BetSettlementNotification | null {
  const [notification, setNotification] = useState<BetSettlementNotification | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<BetSettlementNotification>;
      setNotification(customEvent.detail);
    };

    window.addEventListener("bet:signal", handler);
    return () => window.removeEventListener("bet:signal", handler);
  }, []);

  return notification;
}
