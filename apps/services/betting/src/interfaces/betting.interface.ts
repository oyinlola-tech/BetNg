/**
 * The betting service's data-access contract.
 *
 * Bets are append-mostly: one is written at placement and updated exactly
 * once, by the settlement service, when its match completes. That is why
 * there is no general `update`.
 */

import type { Bet, BetStatus } from "@betng/contracts";

export interface BetFilter {
  readonly userId?: string;
  readonly status?: BetStatus;
}

export interface BetRepository {
  create(bet: Bet): Promise<Bet>;
  find(id: string): Promise<Bet | undefined>;
  list(filter: BetFilter): Promise<readonly Bet[]>;
}
