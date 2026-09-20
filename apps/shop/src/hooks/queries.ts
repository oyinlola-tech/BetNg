import { useEffect } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LeagueId, MatchId } from "@betng/contracts";
import type { MatchFilter, PlaceTicketInput, TicketFilter } from "@betng/ui-core";
import { queryKeys } from "../lib/queryKeys";
import { dataSource, shopSource } from "../services/dataSource";

const LIST_REFRESH_MS = 4000;

export function useLeagues() {
  return useQuery({ queryKey: queryKeys.leagues, queryFn: () => dataSource.listLeagues(), refetchInterval: 30_000 });
}

export function useMatches(filter: MatchFilter, options: { readonly enabled?: boolean; readonly refetchMs?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.matches(filter),
    queryFn: () => dataSource.listMatches(filter),
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchMs ?? LIST_REFRESH_MS,
    placeholderData: (previous) => previous,
  });
}

export function useMarkets(matchId: string | undefined, active = true) {
  return useQuery({
    queryKey: queryKeys.markets(matchId ?? ""),
    queryFn: () => dataSource.getMatchMarkets(matchId as MatchId),
    enabled: matchId !== undefined && active,
    refetchInterval: active ? 6000 : false,
    placeholderData: (previous) => previous,
  });
}

/** Prices for every match on screen, so 1 X 2 can sit inline in the list. */
export function useMarketsFor(matchIds: readonly string[]) {
  return useQueries({
    queries: matchIds.map((id) => ({
      queryKey: queryKeys.markets(id),
      queryFn: () => dataSource.getMatchMarkets(id as MatchId),
      refetchInterval: 6000,
      staleTime: 3000,
    })),
  });
}

export function useCompletedMatchdays(leagueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.matchdays(leagueId ?? ""),
    queryFn: () => dataSource.listCompletedMatchdays(leagueId as LeagueId),
    enabled: leagueId !== undefined,
    refetchInterval: 15_000,
  });
}

export function useTickets(filter: TicketFilter = {}, enabled = true) {
  return useQuery({ queryKey: queryKeys.tickets(filter), queryFn: () => shopSource.listTickets(filter), enabled, refetchInterval: 10_000, placeholderData: (previous) => previous });
}

export function useTicket(code: string | undefined) {
  return useQuery({ queryKey: queryKeys.ticket(code ?? ""), queryFn: () => shopSource.getTicket(code as string), enabled: code !== undefined && code !== "", retry: false });
}

export function useTransactions(date?: string) {
  return useQuery({ queryKey: queryKeys.transactions(date), queryFn: () => shopSource.listTransactions(date), placeholderData: (previous) => previous });
}

export function useDailyReport(date?: string, enabled = true) {
  return useQuery({ queryKey: queryKeys.dailyReport(date), queryFn: () => shopSource.getDailyReport(date), enabled, refetchInterval: 15_000, placeholderData: (previous) => previous });
}

export function useReportRange(from: string, to: string) {
  return useQuery({ queryKey: queryKeys.reportRange(from, to), queryFn: () => shopSource.listDailyReports(from, to), staleTime: 30_000 });
}

export function useCashiers(enabled: boolean) {
  return useQuery({ queryKey: queryKeys.cashiers, queryFn: () => shopSource.listCashiers(), enabled });
}

export function usePlaceTicket() {
  return useMutation({ mutationFn: (input: PlaceTicketInput) => shopSource.placeTicket(input) });
}

export function usePayoutTicket() {
  return useMutation({ mutationFn: (input: { readonly code: string; readonly pin: string }) => shopSource.payoutTicket(input.code, input.pin) });
}

export function useCancelTicket() {
  return useMutation({ mutationFn: (input: { readonly code: string; readonly reason: string }) => shopSource.cancelTicket(input.code, input.reason) });
}

/** Tickets settle and the float moves underneath the screens; one subscription keeps every shop query honest. */
export function useShopSync(): void {
  const client = useQueryClient();

  useEffect(
    () =>
      shopSource.subscribe(() => {
        void client.invalidateQueries({ queryKey: queryKeys.shop });
      }),
    [client],
  );
}
