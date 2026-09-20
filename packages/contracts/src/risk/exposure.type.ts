/**
 * Risk contracts, implemented by the Python risk service.
 *
 * The risk service analyses exposure while a market is still open, so the
 * platform can suspend a market or move a price *before* betting closes. It
 * has no channel to the simulation and cannot influence a result; that
 * separation is the point. See `docs/architecture.md`.
 */

import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  currencySchema,
  isoTimestampSchema,
  minorUnitsSchema,
} from "../common/index.js";

export const selectionExposureSchema = z.object({
  selectionId: brandedIdSchema<"SelectionId">(),
  stake: minorUnitsSchema.min(0),
  liability: minorUnitsSchema.min(0),
});

export type SelectionExposure = z.infer<typeof selectionExposureSchema>;

export const exposureRequestSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  marketId: brandedIdSchema<"MarketId">(),
  selections: z.array(selectionExposureSchema).min(1),
  currency: currencySchema.default("NGN"),
});

export type ExposureRequest = z.infer<typeof exposureRequestSchema>;

export const riskActionSchema = z.enum(["ACCEPT", "REVIEW", "SUSPEND_MARKET"]);

export type RiskAction = z.infer<typeof riskActionSchema>;

export const exposureReportSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  marketId: brandedIdSchema<"MarketId">(),
  worstCaseLiability: minorUnitsSchema.min(0),
  worstCaseSelectionId: brandedIdSchema<"SelectionId">(),
  totalStake: minorUnitsSchema.min(0),
  currency: currencySchema,
  action: riskActionSchema,
  evaluatedAt: isoTimestampSchema,
});

export type ExposureReport = z.infer<typeof exposureReportSchema>;
