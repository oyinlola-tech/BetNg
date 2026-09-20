/**
 * In-memory implementation of {@link BetRepository}.
 *
 * Not a database: it exists so the placement path is exercisable end to end
 * before the betting schema lands, and it is replaced by a PostgreSQL
 * implementation of the same interface.
 */

import type { Bet } from "@betng/contracts";
import type { BetFilter, BetRepository } from "../interfaces/index.js";

export function createInMemoryBetRepository(): BetRepository {
  const bets = new Map<string, Bet>();

  function matchesFilter(bet: Bet, filter: BetFilter): boolean {
    if (filter.userId !== undefined && bet.userId !== filter.userId) {
      return false;
    }

    return filter.status === undefined || bet.status === filter.status;
  }

  return {
    create: async (bet) => {
      bets.set(bet.id, bet);
      return bet;
    },

    find: async (id) => bets.get(id),

    list: async (filter) =>
      [...bets.values()].filter((bet) => matchesFilter(bet, filter)),
  };
}
