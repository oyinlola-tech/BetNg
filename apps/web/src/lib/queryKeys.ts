import type { MatchFilter, SearchQuery, TransactionQuery } from "@betng/ui-core";

export const keys = {
  config: ["config"] as const,
  leagues: ["leagues"] as const,
  league: (id: string) => ["leagues", id] as const,
  teams: (leagueId?: string) => ["teams", leagueId ?? "all"] as const,
  team: (id: string) => ["team", id] as const,
  matchesRoot: ["matches"] as const,
  matches: (filter: MatchFilter) => ["matches", filter] as const,
  match: (id: string) => ["match", id] as const,
  markets: (id: string) => ["markets", id] as const,
  lineups: (id: string) => ["lineups", id] as const,
  headToHead: (id: string) => ["head-to-head", id] as const,
  standings: (leagueId: string, season?: number) => ["standings", leagueId, season ?? "current"] as const,
  scorers: (leagueId: string, season?: number) => ["scorers", leagueId, season ?? "current"] as const,
  matchdays: (leagueId: string, season?: number) => ["matchdays", leagueId, season ?? "current"] as const,
  search: (query: SearchQuery) => ["search", query] as const,
  viewed: ["viewed"] as const,
  wallet: ["wallet"] as const,
  transactionsRoot: ["transactions"] as const,
  transactions: (query: TransactionQuery) => ["transactions", query] as const,
  bets: ["bets"] as const,
  bet: (id: string) => ["bets", id] as const,
  notifications: ["notifications"] as const,
  preferences: ["preferences"] as const,
};

/** Everything that belongs to the signed-in customer; dropped on sign-out. */
export const ACCOUNT_QUERY_KEYS = [
  keys.wallet,
  keys.transactionsRoot,
  keys.bets,
  keys.notifications,
  keys.preferences,
  keys.viewed,
] as const;
