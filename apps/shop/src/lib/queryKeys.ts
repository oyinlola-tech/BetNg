import type { MatchFilter, TicketFilter } from "@betng/ui-core";

export const queryKeys = {
  leagues: ["leagues"] as const,
  matches: (filter: MatchFilter) => ["matches", filter] as const,
  markets: (id: string) => ["markets", id] as const,
  matchdays: (leagueId: string) => ["matchdays", leagueId] as const,
  shop: ["shop"] as const,
  tickets: (filter: TicketFilter) => ["shop", "tickets", filter] as const,
  ticket: (code: string) => ["shop", "ticket", code] as const,
  transactions: (date?: string) => ["shop", "transactions", date ?? "today"] as const,
  dailyReport: (date?: string) => ["shop", "report", date ?? "today"] as const,
  reportRange: (from: string, to: string) => ["shop", "reports", from, to] as const,
  cashiers: ["shop", "cashiers"] as const,
};
