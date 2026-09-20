/**
 * Bet leg contracts.
 */

import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  decimalOddsSchema,
  type MarketId,
  type MatchId,
  type SelectionId,
} from "../common/index.js";

/** One leg of a bet: the outcome backed, at the price offered. */
export interface BetSelection {
  readonly matchId: MatchId;
  readonly marketId: MarketId;
  readonly selectionId: SelectionId;
  /**
   * The price at the moment the bet was accepted.
   *
   * Captured on the bet rather than read back from the odds service at
   * settlement time, so a later re-price cannot change what was agreed.
   */
  readonly odds: number;
}

export const betSelectionSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  marketId: brandedIdSchema<"MarketId">(),
  selectionId: brandedIdSchema<"SelectionId">(),
  odds: decimalOddsSchema,
});
