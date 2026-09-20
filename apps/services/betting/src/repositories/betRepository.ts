/**
 * Bet data access.
 *
 * {@link BetRepository} is the boundary; the foundation ships an in-memory
 * implementation so the placement path is exercisable end to end. The
 * PostgreSQL implementation arrives with the betting schema and satisfies
 * this same interface.
 *
 * Bets are append-mostly: a bet is written once at placement and updated
 * exactly once, by the settlement service, when its match completes. That is
 * why there is no general `update`.
 */

import type { betting as bettingContracts } from "@betng/contracts";

type Bet = bettingContracts.Bet;
type BetStatus = bettingContracts.BetStatus;

export interface BetQuery {
  readonly userId?: string;
  readonly status?: BetStatus;
}

export interface BetRepository {
  create(bet: Bet): Promise<Bet>;
  find(id: string): Promise<Bet | undefined>;
  list(query: BetQuery): Promise<readonly Bet[]>;
}

export function createInMemoryBetRepository(): BetRepository {
  const bets = new Map<string, Bet>();

  return {
    create: (bet) => {
      bets.set(bet.id, bet);
      return Promise.resolve(bet);
    },
    find: (id) => Promise.resolve(bets.get(id)),
    list: (query) =>
      Promise.resolve(
        [...bets.values()].filter((bet) => {
          if (query.userId !== undefined && bet.userId !== query.userId) {
            return false;
          }
          if (query.status !== undefined && bet.status !== query.status) {
            return false;
          }
          return true;
        }),
      ),
  };
}
