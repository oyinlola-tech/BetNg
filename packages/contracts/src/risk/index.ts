/**
 * Risk contracts — implemented by the Python risk service.
 *
 * The risk service analyses exposure while a market is still open, so the
 * platform can suspend a market or adjust a price *before* betting closes.
 * It has no channel to the simulation and cannot influence a result; that
 * separation is the point. See `docs/architecture.md`.
 */

import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  currencySchema,
  isoTimestampSchema,
  minorUnitsSchema,
  type MarketId,
  type MatchId,
  type SelectionId,
} from "../common/primitives.js";

/** The liability carried if one particular selection wins. */
export const selectionExposureSchema = z.object({
  selectionId: brandedIdSchema<"SelectionId">(),
  /** Total simulated stake backing this selection, in minor units. */
  stake: minorUnitsSchema.min(0),
  /** Simulated payout owed if this selection wins, in minor units. */
  liability: minorUnitsSchema.min(0),
});
export type SelectionExposure = z.infer<typeof selectionExposureSchema>;

/** The body of `POST /api/v1/exposure`. */
export const exposureRequestSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  marketId: brandedIdSchema<"MarketId">(),
  selections: z.array(selectionExposureSchema).min(1),
  currency: currencySchema.default("NGN"),
});
export type ExposureRequest = z.infer<typeof exposureRequestSchema>;

/** What the platform should do about a market's current exposure. */
export const riskActionSchema = z.enum([
  /** Exposure is within limits. */
  "ACCEPT",
  /** Exposure is approaching the limit; tighten prices. */
  "REVIEW",
  /** Exposure exceeds the limit; stop accepting bets on this market. */
  "SUSPEND_MARKET",
]);
export type RiskAction = z.infer<typeof riskActionSchema>;

/** The response of `POST /api/v1/exposure`. */
export const exposureReportSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  marketId: brandedIdSchema<"MarketId">(),
  /** The largest liability across all selections — the worst case. */
  worstCaseLiability: minorUnitsSchema.min(0),
  /** The selection responsible for the worst case. */
  worstCaseSelectionId: brandedIdSchema<"SelectionId">(),
  totalStake: minorUnitsSchema.min(0),
  currency: currencySchema,
  action: riskActionSchema,
  evaluatedAt: isoTimestampSchema,
});
export type ExposureReport = z.infer<typeof exposureReportSchema>;

export type { MarketId, MatchId, SelectionId };
