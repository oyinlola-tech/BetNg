import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { LeagueId, MatchId, TeamId } from "@betng/contracts";
import type { MatchFilter, SearchQuery } from "@betng/ui-core";
import { keys } from "../lib/queryKeys";
import { dataSource } from "../services/runtime";

const LIVE_LIST_MS = 10_000;
const SLOW_LIST_MS = 30_000;

export function useLeagues() {
  return useQuery({
    queryKey: keys.leagues,
    queryFn: () => dataSource.listLeagues(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useLeague(leagueId: string | undefined) {
  return useQuery({
    queryKey: keys.league(leagueId ?? ""),
    queryFn: () => dataSource.getLeague(leagueId as LeagueId),
    enabled: leagueId !== undefined,
    staleTime: 30_000,
  });
}

export function useTeams(leagueId?: string, options: { readonly enabled?: boolean } = {}) {
  return useQuery({
    queryKey: keys.teams(leagueId),
    queryFn: () => dataSource.listTeams(leagueId as LeagueId | undefined),
    enabled: options.enabled ?? true,
    staleTime: 5 * 60_000,
  });
}

export function useTeam(teamId: string | undefined) {
  return useQuery({
    queryKey: keys.team(teamId ?? ""),
    queryFn: () => dataSource.getTeam(teamId as TeamId),
    enabled: teamId !== undefined,
    staleTime: 5 * 60_000,
  });
}

export interface MatchListOptions {
  readonly enabled?: boolean;
  /** Lists have no realtime signal, so they poll. `live` lists poll faster than settled ones. */
  readonly pace?: "live" | "slow" | "none";
}

export function useMatches(filter: MatchFilter, options: MatchListOptions = {}) {
  const pace = options.pace ?? "live";

  return useQuery({
    queryKey: keys.matches(filter),
    queryFn: () => dataSource.listMatches(filter),
    enabled: options.enabled ?? true,
    refetchInterval: pace === "none" ? false : pace === "live" ? LIVE_LIST_MS : SLOW_LIST_MS,
    placeholderData: keepPreviousData,
  });
}

export function useMarkets(matchId: string | undefined, options: { readonly poll?: boolean; readonly enabled?: boolean } = {}) {
  return useQuery({
    queryKey: keys.markets(matchId ?? ""),
    queryFn: () => dataSource.getMatchMarkets(matchId as MatchId),
    enabled: matchId !== undefined && (options.enabled ?? true),
    refetchInterval: options.poll === true ? 15_000 : false,
    placeholderData: keepPreviousData,
  });
}

export function useLineups(matchId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: keys.lineups(matchId ?? ""),
    queryFn: () => dataSource.getMatchLineups(matchId as MatchId),
    enabled: matchId !== undefined && enabled,
    staleTime: 60_000,
  });
}

export function useHeadToHead(matchId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: keys.headToHead(matchId ?? ""),
    queryFn: () => dataSource.getHeadToHead(matchId as MatchId),
    enabled: matchId !== undefined && enabled,
    staleTime: 5 * 60_000,
  });
}

export function useStandings(leagueId: string | undefined, season?: number) {
  return useQuery({
    queryKey: keys.standings(leagueId ?? "", season),
    queryFn: () => dataSource.getStandings(leagueId as LeagueId, season),
    enabled: leagueId !== undefined,
    refetchInterval: SLOW_LIST_MS,
    placeholderData: keepPreviousData,
  });
}

export function useTopScorers(leagueId: string | undefined, season?: number) {
  return useQuery({
    queryKey: keys.scorers(leagueId ?? "", season),
    queryFn: () => dataSource.getTopScorers(leagueId as LeagueId, season),
    enabled: leagueId !== undefined,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useCompletedMatchdays(leagueId: string | undefined, season?: number) {
  return useQuery({
    queryKey: keys.matchdays(leagueId ?? "", season),
    queryFn: () => dataSource.listCompletedMatchdays(leagueId as LeagueId, season),
    enabled: leagueId !== undefined,
    refetchInterval: SLOW_LIST_MS,
    placeholderData: keepPreviousData,
  });
}

export function useSearch(query: SearchQuery, enabled: boolean) {
  return useQuery({
    queryKey: keys.search(query),
    queryFn: () => dataSource.search(query),
    enabled,
    staleTime: 30_000,
  });
}

/** Re-reads a match only to classify a failure the live controller reported as text. */
export function useMatchProbe(matchId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: keys.match(matchId ?? ""),
    queryFn: () => dataSource.getMatch(matchId as MatchId),
    enabled: matchId !== undefined && enabled,
    staleTime: 0,
  });
}
