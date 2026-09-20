import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LeagueId, MatchId, TeamId } from "@betng/contracts";
import type { MatchFilter, NotificationPreferences, PlaceBetInput } from "@betng/ui-core";
import { queryKeys } from "../lib/queryKeys";
import { dataSource } from "../services/dataSource";

const LIST_REFRESH_MS = 4000;

export function useLeagues() {
  return useQuery({ queryKey: queryKeys.leagues, queryFn: () => dataSource.listLeagues(), refetchInterval: 30_000 });
}

export function useLeague(leagueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.league(leagueId ?? ""),
    queryFn: () => dataSource.getLeague(leagueId as LeagueId),
    enabled: leagueId !== undefined,
    refetchInterval: 30_000,
  });
}

export function useTeams(leagueId?: string) {
  return useQuery({
    queryKey: queryKeys.teams(leagueId),
    queryFn: () => dataSource.listTeams(leagueId as LeagueId | undefined),
    staleTime: 60_000,
  });
}

export function useTeam(teamId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.team(teamId ?? ""),
    queryFn: () => dataSource.getTeam(teamId as TeamId),
    enabled: teamId !== undefined,
    staleTime: 60_000,
  });
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

export function useMatch(matchId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.match(matchId ?? ""),
    queryFn: () => dataSource.getMatch(matchId as MatchId),
    enabled: matchId !== undefined,
  });
}

export function useMarkets(matchId: string | undefined, active = true) {
  return useQuery({
    queryKey: queryKeys.markets(matchId ?? ""),
    queryFn: () => dataSource.getMatchMarkets(matchId as MatchId),
    enabled: matchId !== undefined,
    refetchInterval: active ? 8000 : false,
    placeholderData: (previous) => previous,
  });
}

export function useStandings(leagueId: string | undefined, season?: number) {
  return useQuery({
    queryKey: queryKeys.standings(leagueId ?? "", season),
    queryFn: () => dataSource.getStandings(leagueId as LeagueId, season),
    enabled: leagueId !== undefined,
    refetchInterval: 15_000,
    placeholderData: (previous) => previous,
  });
}

export function useTopScorers(leagueId: string | undefined, season?: number) {
  return useQuery({
    queryKey: queryKeys.scorers(leagueId ?? "", season),
    queryFn: () => dataSource.getTopScorers(leagueId as LeagueId, season),
    enabled: leagueId !== undefined,
    refetchInterval: 30_000,
    placeholderData: (previous) => previous,
  });
}

export function useCompletedMatchdays(leagueId: string | undefined, season?: number) {
  return useQuery({
    queryKey: queryKeys.matchdays(leagueId ?? "", season),
    queryFn: () => dataSource.listCompletedMatchdays(leagueId as LeagueId, season),
    enabled: leagueId !== undefined,
    refetchInterval: 15_000,
    placeholderData: (previous) => previous,
  });
}

export function useWallet() {
  return useQuery({ queryKey: queryKeys.wallet, queryFn: () => dataSource.getWallet() });
}

export function useTransactions() {
  return useQuery({ queryKey: queryKeys.transactions, queryFn: () => dataSource.listTransactions() });
}

export function useBets() {
  return useQuery({ queryKey: queryKeys.bets, queryFn: () => dataSource.listBets(), refetchInterval: 10_000 });
}

export function useNotifications() {
  return useQuery({ queryKey: queryKeys.notifications, queryFn: () => dataSource.listNotifications(), refetchInterval: 10_000 });
}

export function usePreferences() {
  return useQuery({ queryKey: queryKeys.preferences, queryFn: () => dataSource.getNotificationPreferences() });
}

export function useViewedMatches() {
  return useQuery({ queryKey: queryKeys.viewed, queryFn: () => dataSource.listViewedMatches() });
}

export function usePlaceBet() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: PlaceBetInput) => dataSource.placeBet(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.wallet });
      void client.invalidateQueries({ queryKey: queryKeys.bets });
      void client.invalidateQueries({ queryKey: queryKeys.transactions });
    },
  });
}

export function useDeposit() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (amount: number) => dataSource.deposit(amount),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.wallet });
      void client.invalidateQueries({ queryKey: queryKeys.transactions });
    },
  });
}

export function useWithdraw() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (amount: number) => dataSource.withdraw(amount),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.wallet });
      void client.invalidateQueries({ queryKey: queryKeys.transactions });
    },
  });
}

export function useMarkNotificationsRead() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (ids?: readonly string[]) => dataSource.markNotificationsRead(ids),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useSetPreferences() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (prefs: NotificationPreferences) => dataSource.setNotificationPreferences(prefs),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.preferences });
    },
  });
}

/** Re-reads account queries whenever the platform reports a change (settlement, payout). */
export function useAccountSync(): void {
  const client = useQueryClient();

  useEffect(
    () =>
      dataSource.subscribeAccount(() => {
        void client.invalidateQueries({ queryKey: queryKeys.wallet });
        void client.invalidateQueries({ queryKey: queryKeys.bets });
        void client.invalidateQueries({ queryKey: queryKeys.transactions });
        void client.invalidateQueries({ queryKey: queryKeys.notifications });
      }),
    [client],
  );
}
