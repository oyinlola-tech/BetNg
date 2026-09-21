import { z } from "@zudojs/validation";
import { isoTimestampSchema, minorUnitsSchema } from "../common/index.js";
import { kycDocumentSchema, kycStatusSchema, kycTierSchema } from "../account/kyc.type.js";
import { paymentRecordSchema } from "../account/payments.type.js";
import { limitsSummarySchema } from "../account/limits.type.js";

// Pending backend: operator views over KYC, payments and responsible gaming. Reviews are audit-logged by the platform.

export const kycReviewItemSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().max(60),
  email: z.email(),
  status: kycStatusSchema,
  tier: kycTierSchema,
  submittedAt: isoTimestampSchema,
  documents: z.array(kycDocumentSchema),
});

export type KycReviewItem = z.infer<typeof kycReviewItemSchema>;

export const kycReviewDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "REQUEST_ACTION"]),
  reason: z.string().min(4).max(300),
});

export type KycReviewDecision = z.infer<typeof kycReviewDecisionSchema>;

/** A document preview is a short-lived, platform-signed URL fetched on demand, never stored. */
export const kycDocumentPreviewSchema = z.object({ url: z.url(), expiresAt: isoTimestampSchema, contentType: z.string() });

export type KycDocumentPreview = z.infer<typeof kycDocumentPreviewSchema>;

export const adminPaymentSchema = paymentRecordSchema.extend({
  userId: z.string().min(1),
  userEmail: z.email(),
  providerReference: z.string().max(120).optional(),
});

export type AdminPayment = z.infer<typeof adminPaymentSchema>;

export const paymentOverviewSchema = z.object({
  depositsToday: minorUnitsSchema.min(0),
  withdrawalsToday: minorUnitsSchema.min(0),
  pendingDeposits: z.int().min(0),
  pendingWithdrawals: z.int().min(0),
  failedToday: z.int().min(0),
  providers: z.array(z.object({ provider: z.string(), status: z.enum(["UP", "DEGRADED", "DOWN"]), checkedAt: isoTimestampSchema })),
});

export type PaymentOverview = z.infer<typeof paymentOverviewSchema>;

export const withdrawalReviewSchema = z.object({ decision: z.enum(["APPROVE", "REJECT"]), reason: z.string().min(4).max(300) });

export type WithdrawalReview = z.infer<typeof withdrawalReviewSchema>;

export const responsibleGamingAccountSchema = limitsSummarySchema.extend({
  userId: z.string().min(1),
  displayName: z.string().max(60),
  email: z.email(),
  flaggedAt: isoTimestampSchema.optional(),
  flags: z.array(z.enum(["SELF_EXCLUDED", "LIMIT_BREACH_ATTEMPT", "LIMIT_RAISED", "LONG_SESSION"])),
});

export type ResponsibleGamingAccount = z.infer<typeof responsibleGamingAccountSchema>;
