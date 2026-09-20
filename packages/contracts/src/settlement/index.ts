/**
 * Settlement domain contracts — owned by the settlement service.
 *
 * Settlement reads a completed match result and resolves the bets that
 * reference it. It is strictly downstream of the simulation: it never asks
 * for a result, it only reacts to one that already exists.
 */

import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  currencySchema,
  isoTimestampSchema,
  minorUnitsSchema,
  type BetId,
  type Currency,
  type MatchId,
  type SelectionId,
  type SettlementId,
} from "../common/primitives.js";

export const settlementOutcomeSchema = z.enum(["WON", "LOST", "VOID"]);
export type SettlementOutcome = z.infer<typeof settlementOutcomeSchema>;

/** How one selection on a bet resolved against the match result. */
export interface SettledSelection {
  readonly selectionId: SelectionId;
  readonly matchId: MatchId;
  readonly outcome: SettlementOutcome;
}

export const settledSelectionSchema = z.object({
  selectionId: brandedIdSchema<"SelectionId">(),
  matchId: brandedIdSchema<"MatchId">(),
  outcome: settlementOutcomeSchema,
});

/** The record of one bet being resolved. */
export interface Settlement {
  readonly id: SettlementId;
  readonly betId: BetId;
  readonly outcome: SettlementOutcome;
  readonly selections: readonly SettledSelection[];
  /** Simulated payout in minor units. Zero for a losing bet. */
  readonly payout: number;
  readonly currency: Currency;
  readonly settledAt: string;
}

export const settlementSchema = z.object({
  id: brandedIdSchema<"SettlementId">(),
  betId: brandedIdSchema<"BetId">(),
  outcome: settlementOutcomeSchema,
  selections: z.array(settledSelectionSchema).min(1),
  payout: minorUnitsSchema.min(0),
  currency: currencySchema,
  settledAt: isoTimestampSchema,
});
