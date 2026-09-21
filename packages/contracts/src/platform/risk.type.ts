import { z } from "@zudojs/validation";
import { brandedIdSchema, decimalOddsSchema, isoTimestampSchema, minorUnitsSchema } from "../common/index.js";

export const riskDecisionKindSchema = z.enum(["ACCEPT", "LIMIT", "REJECT"]);

export type RiskDecisionKind = z.infer<typeof riskDecisionKindSchema>;

export const riskReasonSchema = z.enum([
  "WITHIN_LIMIT",
  "STAKE_LIMIT",
  "PAYOUT_LIMIT",
  "EXPOSURE_LIMIT",
  "MARKET_CLOSED",
  "MARKET_SUSPENDED",
  "STAKE_BELOW_MINIMUM",
  "INVALID_SELECTION",
]);

export type RiskReason = z.infer<typeof riskReasonSchema>;

export const riskEvaluateRequestSchema = z.object({
  actor: z.object({
    kind: z.enum(["CUSTOMER", "CASHIER"]),
    id: z.uuid(),
    shopId: z.uuid().optional(),
  }),
  stake: minorUnitsSchema.min(1),
  legs: z
    .array(
      z.object({
        matchId: brandedIdSchema<"MatchId">(),
        marketId: brandedIdSchema<"MarketId">(),
        selectionId: brandedIdSchema<"SelectionId">(),
        odds: decimalOddsSchema,
      }),
    )
    .min(1)
    .max(20),
});

export type RiskEvaluateRequest = z.infer<typeof riskEvaluateRequestSchema>;

/** What risk answers before a stake is accepted. It never names a match outcome. */
export const riskDecisionSchema = z.object({
  decisionId: z.uuid(),
  decision: riskDecisionKindSchema,
  reason: riskReasonSchema,
  maxStake: minorUnitsSchema.min(0),
});

export type RiskDecision = z.infer<typeof riskDecisionSchema>;

export const riskLimitsSchema = z.object({
  version: z.int().min(1),
  minStake: minorUnitsSchema.min(1),
  maxStakePerBet: minorUnitsSchema.min(1),
  maxPayoutPerBet: minorUnitsSchema.min(1),
  maxLiabilityPerSelection: minorUnitsSchema.min(1),
  maxLiabilityPerMarket: minorUnitsSchema.min(1),
  maxLiabilityPerMatch: minorUnitsSchema.min(1),
  updatedAt: isoTimestampSchema,
  updatedBy: z.string().max(80).optional(),
});

export type RiskLimits = z.infer<typeof riskLimitsSchema>;

export const updateRiskLimitsRequestSchema = riskLimitsSchema
  .omit({ version: true, updatedAt: true, updatedBy: true })
  .partial()
  .extend({ reason: z.string().min(4).max(240) });

export type UpdateRiskLimitsRequest = z.infer<typeof updateRiskLimitsRequestSchema>;

export const exposureStatusSchema = z.enum(["NORMAL", "ELEVATED", "CRITICAL", "FROZEN"]);

export const selectionExposureRowSchema = z.object({
  selectionId: brandedIdSchema<"SelectionId">(),
  code: z.string().max(32),
  label: z.string().max(64),
  odds: decimalOddsSchema,
  bets: z.int().min(0),
  customers: z.int().min(0),
  shops: z.int().min(0),
  totalStake: minorUnitsSchema.min(0),
  potentialPayout: minorUnitsSchema.min(0),
  /** `potentialPayout - marketStake`: what the book loses on this market if this selection wins. */
  netExposure: minorUnitsSchema,
  status: exposureStatusSchema,
});

export const marketExposureSchema = z.object({
  marketId: brandedIdSchema<"MarketId">(),
  type: z.string().max(32),
  line: z.number().optional(),
  totalStake: minorUnitsSchema.min(0),
  worstCaseExposure: minorUnitsSchema,
  selections: z.array(selectionExposureRowSchema),
});

/** One match on the exposure dashboard. Every number is an aggregate over accepted bets. */
export const matchExposureSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  leagueName: z.string().max(120),
  matchLabel: z.string().max(160),
  kickoffAt: isoTimestampSchema,
  lifecycle: z.string().max(32),
  frozenAt: isoTimestampSchema.optional(),
  bets: z.int().min(0),
  totalStake: minorUnitsSchema.min(0),
  worstCaseExposure: minorUnitsSchema,
  status: exposureStatusSchema,
  markets: z.array(marketExposureSchema),
});

export type MatchExposure = z.infer<typeof matchExposureSchema>;
