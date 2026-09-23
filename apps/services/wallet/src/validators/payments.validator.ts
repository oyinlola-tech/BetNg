import {
  bankAccountVerifyRequestSchema,
  cashMovementRequestSchema,
  floatTransferRequestSchema,
  closeShiftRequestSchema,
  depositInitiateRequestSchema,
  openShiftRequestSchema,
  paymentDirectionSchema,
  paymentStatusSchema,
  statementRequestSchema,
  withdrawalRequestSchema,
  withdrawalReviewSchema,
} from "@betng/contracts";
import { z } from "@zudojs/validation";
import { PROVIDER_IDS } from "../constants/payments.constant.js";

export const uuidSchema = z.uuid();

export const referenceSchema = z.string().regex(/^[A-Za-z0-9_-]{6,64}$/u, "Not a payment reference.");

const pageShape = {
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const depositInitiateSchema = depositInitiateRequestSchema.strict();

export const depositVerifySchema = z.strictObject({ reference: referenceSchema });

export const historyQuerySchema = z.strictObject({
  ...pageShape,
  direction: paymentDirectionSchema.optional(),
  status: paymentStatusSchema.optional(),
});

export const withdrawalSchema = withdrawalRequestSchema.extend({ bankAccountId: uuidSchema }).strict();

export const bankAccountVerifySchema = bankAccountVerifyRequestSchema.strict();

export const saveBankAccountSchema = z.strictObject({
  verificationId: uuidSchema,
  makeDefault: z.boolean().default(false),
});

export const statementSchema = statementRequestSchema
  .extend({ types: z.array(z.string().max(40)).max(20).optional() })
  .strict();

export const openShiftSchema = openShiftRequestSchema.extend({ openingFloat: z.int().min(0).max(1_000_000_000) }).strict();

export const cashMovementSchema = cashMovementRequestSchema.extend({ amount: z.int().min(1).max(1_000_000_000) }).strict();

export const floatTransferSchema = floatTransferRequestSchema
  .extend({ amount: z.int().min(1).max(1_000_000_000), toCashierId: z.uuid() })
  .strict();

export const closeShiftSchema = closeShiftRequestSchema
  .extend({ counted: closeShiftRequestSchema.shape.counted.max(20) })
  .strict();

export const shiftListQuerySchema = z.strictObject({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Use YYYY-MM-DD.").optional(),
});

const instantSchema = z
  .string()
  .max(40)
  .refine((value) => !Number.isNaN(Date.parse(value)), "Not a date or timestamp.")
  .transform((value) => new Date(value));

export const adminPaymentsQuerySchema = z.strictObject({
  ...pageShape,
  direction: paymentDirectionSchema.optional(),
  status: paymentStatusSchema.optional(),
  provider: z.enum(PROVIDER_IDS).optional(),
  from: instantSchema.optional(),
  to: instantSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

export const reviewSchema = withdrawalReviewSchema.strict();
