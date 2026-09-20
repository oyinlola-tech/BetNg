/**
 * The domain events the betting service publishes.
 *
 * A placed bet is the signal the risk service needs while a market is
 * still open — it is what exposure is computed from. Publishing it here,
 * rather than having risk poll the betting database, is what keeps the two
 * services independently deployable and keeps bet data out of everything
 * downstream of the simulation.
 */

import { defineEvent } from "@zudojs/events";
import type { BetSelection, Currency } from "@betng/contracts";

/** What a placed-bet event carries. */
export interface BetPlacedPayload {
  readonly betId: string;
  readonly userId: string;
  readonly selections: readonly BetSelection[];
  /** Simulated stake in minor units. */
  readonly stake: number;
  readonly totalOdds: number;
  /** Simulated payout if the slip wins, in minor units. */
  readonly potentialPayout: number;
  readonly currency: Currency;
}

/** Published whenever a bet slip is accepted. */
export const BetPlacedEvent = defineEvent<"betting.betPlaced", BetPlacedPayload>(
  "betting.betPlaced",
);
