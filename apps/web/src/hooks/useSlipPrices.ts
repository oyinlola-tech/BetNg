import { useEffect, useMemo } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import type {
  MatchMarketsView,
  MatchSignal,
  SlipSelection,
} from "@betng/ui-core";
import { keys } from "../lib/queryKeys";
import { dataSource } from "../services/runtime";
import type { OddsChange } from "../stores/betslip.store";

export const SLIP_PRICE_INTERVAL_MS = 10_000;

export type SlipPriceStatus =
  | { readonly kind: "OK" }
  | { readonly kind: "PRICE_CHANGED"; readonly currentOdds: number }
  | { readonly kind: "SUSPENDED" }
  | { readonly kind: "CLOSED" }
  | { readonly kind: "UNAVAILABLE" };

export interface SlipPrices {
  readonly statuses: ReadonlyMap<string, SlipPriceStatus>;
  readonly checking: boolean;
  readonly changed: readonly OddsChange[];
  /** Selections the platform will not take right now: suspended, closed or gone. */
  readonly blocked: readonly string[];
  readonly refresh: () => void;
}

const PRICE_SIGNALS: ReadonlySet<MatchSignal> = new Set([
  "ODDS_UPDATED",
  "MARKET_UPDATED",
  "BETTING_OPENED",
  "BETTING_CLOSED",
  "MATCH_UPDATED",
]);

const OK: SlipPriceStatus = { kind: "OK" };

export function priceStatus(
  selection: SlipSelection,
  markets: MatchMarketsView | undefined,
): SlipPriceStatus {
  if (markets === undefined) return OK;

  const market = markets.markets.find((m) => m.id === selection.marketId);

  if (market === undefined) return { kind: "UNAVAILABLE" };
  if (market.status === "SUSPENDED") return { kind: "SUSPENDED" };
  if (market.status !== "OPEN") return { kind: "CLOSED" };

  const current = market.selections.find((s) => s.id === selection.selectionId);

  if (current === undefined || current.status === "UNAVAILABLE")
    return { kind: "UNAVAILABLE" };
  if (current.status === "SUSPENDED") return { kind: "SUSPENDED" };
  if (current.odds !== selection.odds)
    return { kind: "PRICE_CHANGED", currentOdds: current.odds };

  return OK;
}

export function useSlipPrices(selections: readonly SlipSelection[]): SlipPrices {
  const client = useQueryClient();
  const matchIds = useMemo(
    () => [...new Set(selections.map((s) => s.matchId))].sort(),
    [selections],
  );
  const matchKey = matchIds.join("|");

  const results = useQueries({
    queries: matchIds.map((matchId) => ({
      queryKey: keys.markets(matchId),
      queryFn: () => dataSource.getMatchMarkets(matchId),
      refetchInterval: SLIP_PRICE_INTERVAL_MS,
      staleTime: 4_000,
    })),
  });

  useEffect(() => {
    const subscriptions = matchIds.map((matchId) =>
      dataSource.subscribeMatch(matchId, {
        onEvent: () => undefined,
        onConnection: () => undefined,
        onSignal: (signal) => {
          if (PRICE_SIGNALS.has(signal))
            void client.invalidateQueries({ queryKey: keys.markets(matchId) });
        },
      }),
    );

    return () => {
      for (const subscription of subscriptions) subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchKey stands for matchIds
  }, [client, matchKey]);

  return useMemo(() => {
    const statuses = new Map<string, SlipPriceStatus>();
    const changed: OddsChange[] = [];
    const blocked: string[] = [];

    for (const selection of selections) {
      const markets = results[matchIds.indexOf(selection.matchId)]?.data;
      const status = priceStatus(selection, markets);

      statuses.set(selection.selectionId, status);

      if (status.kind === "PRICE_CHANGED")
        changed.push({
          selectionId: selection.selectionId,
          odds: status.currentOdds,
        });
      else if (status.kind !== "OK") blocked.push(selection.selectionId);
    }

    return {
      statuses,
      checking: results.some((r) => r.isFetching),
      changed,
      blocked,
      refresh: () => {
        for (const matchId of matchIds)
          void client.invalidateQueries({ queryKey: keys.markets(matchId) });
      },
    };
  }, [selections, results, matchIds, client]);
}
