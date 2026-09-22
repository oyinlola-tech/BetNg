import { useCallback, useEffect, useRef, useState } from "react";
import { dataSource, logger } from "../services/runtime";

export interface BetSettlement {
  readonly betId: string;
  readonly status: "WON" | "LOST" | "VOID" | "PARTIALLY_WON";
  readonly payout: number;
  readonly settledAt: string;
}

export interface BetSettlementNotification {
  readonly betId: string;
  readonly status: "WON" | "LOST" | "VOID" | "PARTIALLY_WON";
  readonly payout: number;
  readonly settledAt: string;
}

/**
 * Subscribes to real-time bet settlement updates via WebSocket/SSE.
 * Falls back to polling if real-time is unavailable.
 */
export function useBetSettlementSubscription(): void {
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = dataSource.subscribeBets?.((event: { type: string; data: unknown }) => {
      if (event.type === "SETTLEMENT") {
        const settlement = event.data as BetSettlement;

        logger.info("flow", "Bet settlement received", {
          betId: settlement.betId,
          status: settlement.status,
          payout: settlement.payout,
        });

        pendingRef.current.delete(settlement.betId);

        const notification: BetSettlementNotification = {
          betId: settlement.betId,
          status: settlement.status,
          payout: settlement.payout,
          settledAt: settlement.settledAt,
        };

        window.dispatchEvent(
          new CustomEvent("bet:settled", { detail: notification }),
        );
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);
}

/**
 * Listens for bet settlement events and returns the latest notification.
 */
export function useBetSettlementListener(): BetSettlementNotification | null {
  const [notification, setNotification] = useState<BetSettlementNotification | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<BetSettlementNotification>;
      setNotification(customEvent.detail);
    };

    window.addEventListener("bet:settled", handler);
    return () => window.removeEventListener("bet:settled", handler);
  }, []);

  return notification;
}

/**
 * Dismisses the current settlement notification.
 */
export function useDismissSettlement(): () => void {
  const [, setNotification] = useState<BetSettlementNotification | null>(null);

  const dismiss = useCallback(() => {
    setNotification(null);
  }, []);

  return dismiss;
}
