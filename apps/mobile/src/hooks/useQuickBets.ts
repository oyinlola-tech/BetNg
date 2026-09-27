import { useMemo } from "react";
import type { MatchMarketsView, MatchSummary } from "@betng/ui-core";
import { marketsByMatch, quickBetIds } from "../lib/quickBet";
import { getDataSource } from "../services/dataSource";
import { useAsync } from "./useAsync";

const PRICE_REFRESH_MS = 8000;

export interface QuickBets {
  readonly byMatch: ReadonlyMap<string, MatchMarketsView>;
  readonly loading: boolean;
  readonly failed: boolean;
  readonly refresh: () => Promise<void>;
}

/** Prices for every bettable match in the list, in one read. */
export function useQuickBets(matches: readonly MatchSummary[] | undefined): QuickBets {
  const ids = useMemo(() => quickBetIds(matches ?? []), [matches]);
  const key = ids.join(",");
  const prices = useAsync(
    () => (ids.length === 0 ? Promise.resolve([] as readonly MatchMarketsView[]) : getDataSource().listMatchMarkets(ids)),
    [key],
    PRICE_REFRESH_MS,
  );
  const byMatch = useMemo(() => marketsByMatch(prices.data), [prices.data]);

  return {
    byMatch,
    loading: prices.loading && prices.data === undefined,
    failed: prices.error !== undefined && prices.data === undefined,
    refresh: prices.refresh,
  };
}
