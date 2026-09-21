import {
  operatorPeriodKindSchema,
  settlementOutcomeSchema,
  settlementStatusSchema,
  updateCommissionConfigRequestSchema,
  uuidSchema,
} from "@betng/contracts";
import { z } from "@zudojs/validation";
import { LIST_LIMIT } from "../constants/index.js";
import { PERIOD_ID_PATTERN } from "../utils/index.js";

function limitSchema(max: number): z.ZodType<number | undefined> {
  return z.coerce.number().int().min(1).max(max).optional();
}

export const matchIdParamSchema = uuidSchema;

export const betIdParamSchema = uuidSchema;

export const settleMatchPayloadSchema = z.strictObject({ matchId: uuidSchema });

export const voidMatchPayloadSchema = z.strictObject({
  matchId: uuidSchema,
  reason: z.string().trim().min(4).max(240),
});

export const listSettlementsQuerySchema = z.strictObject({
  status: settlementOutcomeSchema.optional(),
  matchId: uuidSchema.optional(),
  limit: limitSchema(LIST_LIMIT.SETTLEMENTS_MAX),
});

export const listAdminSettlementsQuerySchema = z.strictObject({
  status: settlementStatusSchema.exclude(["NOT_DUE"]).optional(),
  limit: limitSchema(LIST_LIMIT.ADMIN_SETTLEMENTS_MAX),
});

export const retrySettlementBodySchema = z.strictObject({
  reason: z.string().trim().min(4).max(240),
});

export const listLimitQuerySchema = z.strictObject({
  limit: limitSchema(LIST_LIMIT.PERIODS_MAX),
});

export const closePeriodBodySchema = z.strictObject({
  reason: z.string().trim().min(4).max(240),
  kind: operatorPeriodKindSchema.optional(),
});

export const listCommissionQuerySchema = z.strictObject({
  periodId: z.string().regex(PERIOD_ID_PATTERN).optional(),
  limit: limitSchema(LIST_LIMIT.COMMISSION_MAX),
});

const TWO_DECIMALS = /^\d{1,3}(?:\.\d{1,2})?$/;

export const updateCommissionConfigBodySchema = updateCommissionConfigRequestSchema
  .strict()
  .refine((body) => TWO_DECIMALS.test(String(body.shopSharePercent)), {
    path: ["shopSharePercent"],
    message: "A share percent has at most two decimal places.",
  });
