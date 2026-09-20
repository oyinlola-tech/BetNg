import type { MatchFilter } from "@betng/ui-core";

export const queryKeys = {
  leagues: ["leagues"] as const,
  league: (id: string) => ["leagues", id] as const,
  teams: (leagueId?: string) => ["teams", leagueId ?? "all"] as const,
  team: (id: string) => ["team", id] as const,
  matches: (filter: MatchFilter) => ["matches", filter] as const,
  match: (id: string) => ["match", id] as const,
  markets: (id: string) => ["markets", id] as const,
  standings: (leagueId: string, season?: number) => ["standings", leagueId, season ?? "current"] as const,
  scorers: (leagueId: string, season?: number) => ["scorers", leagueId, season ?? "current"] as const,
  matchdays: (leagueId: string, season?: number) => ["matchdays", leagueId, season ?? "current"] as const,
  wallet: ["wallet"] as const,
  transactions: ["transactions"] as const,
  bets: ["bets"] as const,
  notifications: ["notifications"] as const,
  preferences: ["preferences"] as const,
  viewed: ["viewed"] as const,
};
