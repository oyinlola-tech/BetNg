import { z } from "@zudojs/validation";
import { isoTimestampSchema, minorUnitsSchema } from "../common/index.js";

export const operatorPeriodKindSchema = z.enum(["HOUR", "DAY", "MATCHDAY", "ROUND", "CUSTOM"]);

export const operatorPeriodSchema = z.object({
  /** e.g. `SESSION-20260921-0001`. */
  id: z.string().min(8).max(40),
  kind: operatorPeriodKindSchema,
  status: z.enum(["OPEN", "CLOSED"]),
  startsAt: isoTimestampSchema,
  endsAt: isoTimestampSchema.optional(),
});

export type OperatorPeriod = z.infer<typeof operatorPeriodSchema>;

/**
 * The simulated platform result for a period. `operatorResult = grossStakes - grossPayouts` and may be negative;
 * it is recorded as it is. This is the operator's ledger, not anybody's wallet.
 */
export const operatorSummarySchema = z.object({
  period: operatorPeriodSchema,
  grossStakes: minorUnitsSchema.min(0),
  grossPayouts: minorUnitsSchema.min(0),
  operatorResult: minorUnitsSchema,
  /** `operatorResult / grossStakes`, 0 when there were no stakes. */
  operatorResultRate: z.number(),
  settledBets: z.int().min(0),
  voidBets: z.int().min(0),
  refundedStakes: minorUnitsSchema.min(0),
});

export type OperatorSummary = z.infer<typeof operatorSummarySchema>;

export const commissionConfigSchema = z.object({
  shopId: z.uuid().optional(),
  shopSharePercent: z.number().min(0).max(100),
  effectiveFrom: isoTimestampSchema,
  updatedBy: z.string().max(80).optional(),
});

export type CommissionConfig = z.infer<typeof commissionConfigSchema>;

export const updateCommissionConfigRequestSchema = z.object({
  shopId: z.uuid().optional(),
  shopSharePercent: z.number().min(0).max(100),
  reason: z.string().min(4).max(240),
});

export type UpdateCommissionConfigRequest = z.infer<typeof updateCommissionConfigRequestSchema>;

export const commissionSummarySchema = z.object({
  periodId: z.string().max(40),
  shopId: z.uuid(),
  shopName: z.string().max(80).optional(),
  grossStakes: minorUnitsSchema.min(0),
  grossPayouts: minorUnitsSchema.min(0),
  grossOperatorResult: minorUnitsSchema,
  shopSharePercent: z.number().min(0).max(100),
  shopShareAmount: minorUnitsSchema.min(0),
  platformSharePercent: z.number().min(0).max(100),
  platformShareAmount: minorUnitsSchema,
  createdAt: isoTimestampSchema,
});

export type CommissionSummary = z.infer<typeof commissionSummarySchema>;

export const matchSettlementSchema = z.object({
  matchId: z.uuid(),
  status: z.enum(["STARTED", "COMPLETED", "FAILED"]),
  betsTotal: z.int().min(0),
  betsSettled: z.int().min(0),
  duplicate: z.boolean(),
});

export type MatchSettlement = z.infer<typeof matchSettlementSchema>;
