import type { AdminCustomer, AdminFixture } from "@betng/contracts";

export const customer = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "ada@example.test",
  displayName: "Ada Obi",
  status: "ACTIVE",
  createdAt: "2026-08-01T10:00:00.000Z",
  lastActiveAt: "2026-09-21T11:00:00.000Z",
  balance: 1_250_000,
  openBets: 2,
  lifetimeStake: 9_000_000,
  lifetimePayout: 7_500_000,
} as AdminCustomer;

export const fixture = {
  matchId: "22222222-2222-4222-8222-222222222222",
  leagueId: "33333333-3333-4333-8333-333333333333",
  leagueName: "Test League",
  season: 1,
  matchday: 4,
  homeName: "Harbour Town",
  awayName: "Ridge United",
  kickoffAt: "2026-09-21T13:00:00.000Z",
  score: { home: 0, away: 0 },
  matchStatus: "BETTING_OPEN",
  bettingStatus: "OPEN",
  simulationStatus: "FAILED",
  settlementStatus: "NOT_DUE",
} as AdminFixture;

export const page = <T>(items: readonly T[]): { readonly items: readonly T[]; readonly page: number; readonly pageSize: number; readonly total: number } => ({ items, page: 1, pageSize: 25, total: items.length });
