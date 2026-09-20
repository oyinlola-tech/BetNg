import { useMemo } from "react";
import type { SlipSelection } from "@betng/ui-core";
import { useMarketsFor } from "./queries";

export interface LegIssue {
  readonly kind: "PRICE" | "CLOSED";
  readonly currentOdds?: number;
}

export interface SlipWatch {
  readonly issues: ReadonlyMap<string, LegIssue>;
  readonly prices: ReadonlyMap<string, number>;
  readonly updating: boolean;
  readonly priceChanges: number;
  readonly closed: number;
}

/** Re-reads the price and status of every leg while the slip is open; the platform re-checks them again when the ticket is placed. */
export function useSlipWatch(selections: readonly SlipSelection[]): SlipWatch {
  const matchIds = useMemo(() => [...new Set(selections.map((s) => s.matchId as string))], [selections]);
  const results = useMarketsFor(matchIds);

  return useMemo(() => {
    const issues = new Map<string, LegIssue>();
    const prices = new Map<string, number>();

    for (const leg of selections) {
      const data = results[matchIds.indexOf(leg.matchId)]?.data;

      if (data === undefined) continue;

      const market = data.markets.find((m) => m.id === leg.marketId);
      const current = market?.selections.find((s) => s.id === leg.selectionId);

      if (market === undefined || current === undefined || market.status !== "OPEN") {
        issues.set(leg.selectionId, { kind: "CLOSED" });
        continue;
      }

      prices.set(leg.selectionId, current.odds);

      if (Math.abs(current.odds - leg.odds) > 0.005) issues.set(leg.selectionId, { kind: "PRICE", currentOdds: current.odds });
    }

    const all = [...issues.values()];

    return {
      issues,
      prices,
      updating: results.some((r) => r.isPending),
      priceChanges: all.filter((i) => i.kind === "PRICE").length,
      closed: all.filter((i) => i.kind === "CLOSED").length,
    };
  }, [selections, results, matchIds]);
}
