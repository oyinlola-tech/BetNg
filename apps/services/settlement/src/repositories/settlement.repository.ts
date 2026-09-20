/**
 * In-memory implementation of {@link SettlementRepository}.
 *
 * Not a database: it exists so the read path is exercisable before the
 * settlement schema lands, and it is replaced by a PostgreSQL
 * implementation of the same interface.
 *
 * It starts empty, and this phase has nothing that writes to it, because
 * settling a bet requires the settlement algorithm that belongs to a later
 * phase. An empty list is the honest answer.
 */

import type { Settlement } from "@betng/contracts";
import type { SettlementRepository } from "../interfaces/index.js";

export function createInMemorySettlementRepository(): SettlementRepository {
  const settlements = new Map<string, Settlement>();

  return {
    create: async (settlement) => {
      settlements.set(settlement.betId, settlement);
      return settlement;
    },

    findByBet: async (betId) => settlements.get(betId),

    list: async () => [...settlements.values()],
  };
}
