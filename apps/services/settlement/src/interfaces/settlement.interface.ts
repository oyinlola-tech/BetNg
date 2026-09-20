/**
 * The settlement service's data-access contract.
 *
 * A settlement is written once and never changed: it records how a bet
 * resolved against a match result that already existed. Re-settling a bet
 * would mean writing a second record, not editing the first, which is what
 * keeps the history auditable.
 */

import type { Settlement } from "@betng/contracts";

export interface SettlementRepository {
  create(settlement: Settlement): Promise<Settlement>;
  findByBet(betId: string): Promise<Settlement | undefined>;
  list(): Promise<readonly Settlement[]>;
}
