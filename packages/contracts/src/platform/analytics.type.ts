import { z } from "@zudojs/validation";
import { isoTimestampSchema, minorUnitsSchema } from "../common/index.js";

const count = z.int().min(0);

export const analyticsOverviewSchema = z.object({
  from: isoTimestampSchema.optional(),
  to: isoTimestampSchema.optional(),
  totalMatches: count,
  totalBets: count,
  acceptedBets: count,
  limitedBets: count,
  rejectedBets: count,
  pendingBets: count,
  settledBets: count,
  winningBets: count,
  losingBets: count,
  voidBets: count,
  cancelledBets: count,
  totalStake: minorUnitsSchema.min(0),
  pendingStake: minorUnitsSchema.min(0),
  settledStake: minorUnitsSchema.min(0),
  totalPayout: minorUnitsSchema.min(0),
  operatorResult: minorUnitsSchema,
  operatorResultRate: z.number(),
  customers: count,
  shops: count,
  cashiers: count,
  generatedAt: isoTimestampSchema,
});

export type AnalyticsOverview = z.infer<typeof analyticsOverviewSchema>;

export const analyticsDimensionSchema = z.enum([
  "league",
  "match",
  "market",
  "selection",
  "shop",
  "cashier",
  "customer",
  "channel",
  "hour",
  "day",
]);

export type AnalyticsDimension = z.infer<typeof analyticsDimensionSchema>;

export const analyticsBreakdownRowSchema = z.object({
  key: z.string().max(80),
  label: z.string().max(200),
  bets: count,
  pendingBets: count,
  winningBets: count,
  losingBets: count,
  voidBets: count,
  stake: minorUnitsSchema.min(0),
  payout: minorUnitsSchema.min(0),
  pendingLiability: minorUnitsSchema.min(0),
  operatorResult: minorUnitsSchema,
  operatorResultRate: z.number(),
});

export type AnalyticsBreakdownRow = z.infer<typeof analyticsBreakdownRowSchema>;

export const analyticsBreakdownSchema = z.object({
  by: analyticsDimensionSchema,
  from: isoTimestampSchema.optional(),
  to: isoTimestampSchema.optional(),
  items: z.array(analyticsBreakdownRowSchema),
});

export type AnalyticsBreakdown = z.infer<typeof analyticsBreakdownSchema>;

export const analyticsQuerySchema = z.object({
  from: isoTimestampSchema.optional(),
  to: isoTimestampSchema.optional(),
  by: analyticsDimensionSchema.optional(),
  leagueId: z.uuid().optional(),
  matchId: z.uuid().optional(),
  shopId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export const sessionAnalysisSchema = z.object({
  sessionId: z.string().max(60),
  kind: z.enum(["HOUR", "DAY", "MATCHDAY", "ROUND", "CUSTOM"]),
  label: z.string().max(120),
  startsAt: isoTimestampSchema,
  endsAt: isoTimestampSchema,
  bets: count,
  stake: minorUnitsSchema.min(0),
  payout: minorUnitsSchema.min(0),
  operatorResult: minorUnitsSchema,
  operatorResultRate: z.number(),
  customers: count,
  shops: count,
  cashiers: count,
  markets: count,
  matches: count,
});

export type SessionAnalysis = z.infer<typeof sessionAnalysisSchema>;

/** A view over the global bets for one customer, shop or cashier. It never implies separate games. */
export const accountAnalysisSchema = z.object({
  subjectKind: z.enum(["CUSTOMER", "SHOP", "CASHIER"]),
  subjectId: z.uuid(),
  label: z.string().max(120),
  bets: count,
  pendingBets: count,
  wins: count,
  losses: count,
  voids: count,
  stake: minorUnitsSchema.min(0),
  payout: minorUnitsSchema.min(0),
  /** `payout - stake` over settled bets: positive means the account is ahead. */
  netResult: minorUnitsSchema,
  operatorContribution: minorUnitsSchema,
  commission: minorUnitsSchema.min(0).optional(),
  transactions: count.optional(),
});

export type AccountAnalysis = z.infer<typeof accountAnalysisSchema>;
