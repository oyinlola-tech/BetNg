import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { SlipSelection } from "@betng/ui-core";
import { queryKeys } from "../lib/queryKeys";
import { dataSource } from "../services/dataSource";
import { useNow } from "@betng/ui-web";

export type SlipLineState = "OK" | "CHANGED" | "SUSPENDED";

export interface SlipLine {
  readonly state: SlipLineState;
  /** The platform's current price, when it differs from the one on the slip. */
  readonly currentOdds?: number;
}

export interface SlipPrices {
  readonly lines: ReadonlyMap<string, SlipLine>;
  readonly updating: boolean;
  readonly changed: readonly { readonly selectionId: string; readonly odds: number }[];
  readonly suspended: readonly string[];
}

/** Compares every selection on the slip with the platform's live price and market status. */
export function useSlipPrices(selections: readonly SlipSelection[]): SlipPrices {
  const matchIds = useMemo(() => [...new Set(selections.map((s) => s.matchId))], [selections]);
  const now = useNow(5000);
  const results = useQueries({
    queries: matchIds.map((matchId) => ({
      queryKey: queryKeys.markets(matchId),
      queryFn: () => dataSource.getMatchMarkets(matchId),
      refetchInterval: 8000,
    })),
  });

  return useMemo(() => {
    const lines = new Map<string, SlipLine>();
    const changed: { selectionId: string; odds: number }[] = [];
    const suspended: string[] = [];

    for (const selection of selections) {
      const markets = results[matchIds.indexOf(selection.matchId)]?.data;
      const market = markets?.markets.find((m) => m.id === selection.marketId);
      const live = market?.selections.find((s) => s.id === selection.selectionId);
      const started = Date.parse(selection.kickoffAt) <= now;

      if (started || (markets !== undefined && (market === undefined || live === undefined || market.status !== "OPEN"))) {
        lines.set(selection.selectionId, { state: "SUSPENDED" });
        suspended.push(selection.selectionId);
      } else if (live !== undefined && live.odds !== selection.odds) {
        lines.set(selection.selectionId, { state: "CHANGED", currentOdds: live.odds });
        changed.push({ selectionId: selection.selectionId, odds: live.odds });
      } else {
        lines.set(selection.selectionId, { state: "OK" });
      }
    }

    return { lines, updating: results.some((r) => r.isFetching), changed, suspended };
  }, [selections, results, matchIds, now]);
}
