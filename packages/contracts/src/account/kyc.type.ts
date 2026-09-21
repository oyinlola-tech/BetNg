import { z } from "@zudojs/validation";
import { isoTimestampSchema } from "../common/index.js";

// Pending backend: the KYC service. Identity and bank verification providers are called server-side only.

export const kycStatusSchema = z.enum(["NOT_STARTED", "PENDING", "VERIFIED", "REJECTED", "REQUIRES_ACTION"]);

export type KycStatus = z.infer<typeof kycStatusSchema>;

export const kycTierSchema = z.enum(["TIER_0", "TIER_1", "TIER_2", "TIER_3"]);

export type KycTier = z.infer<typeof kycTierSchema>;

export const kycDocumentTypeSchema = z.enum(["NATIONAL_ID", "PASSPORT", "DRIVERS_LICENSE", "VOTERS_CARD", "PROOF_OF_ADDRESS", "SELFIE"]);

export type KycDocumentType = z.infer<typeof kycDocumentTypeSchema>;

export const kycCheckSchema = z.enum(["BVN", "NIN", "DOCUMENT", "ADDRESS", "LIVENESS"]);

export type KycCheck = z.infer<typeof kycCheckSchema>;

export interface KycRequirement {
  readonly check: KycCheck;
  readonly status: KycStatus;
  readonly message?: string | undefined;
}

export interface KycOverview {
  readonly status: KycStatus;
  readonly tier: KycTier;
  readonly requirements: readonly KycRequirement[];
  /** What the current tier unlocks, as the platform states it. */
  readonly limits?: { readonly dailyDeposit?: number | undefined; readonly dailyWithdrawal?: number | undefined } | undefined;
  readonly reviewedAt?: string | undefined;
  readonly rejectionReason?: string | undefined;
}

export const kycRequirementSchema = z.object({
  check: kycCheckSchema,
  status: kycStatusSchema,
  message: z.string().max(200).optional(),
});

export const kycOverviewSchema = z.object({
  status: kycStatusSchema,
  tier: kycTierSchema,
  requirements: z.array(kycRequirementSchema),
  limits: z.object({ dailyDeposit: z.int().min(0).optional(), dailyWithdrawal: z.int().min(0).optional() }).optional(),
  reviewedAt: isoTimestampSchema.optional(),
  rejectionReason: z.string().max(200).optional(),
});

export interface KycDocument {
  readonly id: string;
  readonly type: KycDocumentType;
  readonly status: KycStatus;
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly uploadedAt: string;
  readonly reviewedAt?: string | undefined;
  readonly rejectionReason?: string | undefined;
}

export const kycDocumentSchema = z.object({
  id: z.string().min(1),
  type: kycDocumentTypeSchema,
  status: kycStatusSchema,
  fileName: z.string().max(200),
  sizeBytes: z.int().min(0),
  uploadedAt: isoTimestampSchema,
  reviewedAt: isoTimestampSchema.optional(),
  rejectionReason: z.string().max(200).optional(),
});

export const KYC_ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;

export const KYC_MAX_BYTES = 10 * 1024 * 1024;

export const kycUploadRequestSchema = z.object({
  type: kycDocumentTypeSchema,
  fileName: z.string().min(1).max(200),
  contentType: z.enum(KYC_ACCEPTED_TYPES),
  sizeBytes: z.int().min(1).max(KYC_MAX_BYTES),
});

export type KycUploadRequest = z.infer<typeof kycUploadRequestSchema>;

/** A short-lived, single-use upload target issued by the platform. The client never learns where the file is stored afterwards. */
export interface KycUploadTicket {
  readonly uploadId: string;
  readonly uploadUrl: string;
  readonly method: "PUT" | "POST";
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: string;
}

export const kycUploadTicketSchema = z.object({
  uploadId: z.string().min(1),
  uploadUrl: z.url(),
  method: z.enum(["PUT", "POST"]),
  headers: z.record(z.string(), z.string()),
  expiresAt: isoTimestampSchema,
});

export const kycSubmitDocumentRequestSchema = z.object({ uploadId: z.string().min(1) });

export type KycSubmitDocumentRequest = z.infer<typeof kycSubmitDocumentRequestSchema>;

export const bvnVerifyRequestSchema = z.object({ bvn: z.string().regex(/^\d{11}$/, "A BVN has 11 digits."), dateOfBirth: z.iso.date() });

export type BvnVerifyRequest = z.infer<typeof bvnVerifyRequestSchema>;

export const ninVerifyRequestSchema = z.object({ nin: z.string().regex(/^\d{11}$/, "A NIN has 11 digits."), dateOfBirth: z.iso.date() });

export type NinVerifyRequest = z.infer<typeof ninVerifyRequestSchema>;

export interface IdentityCheckResult {
  readonly check: "BVN" | "NIN";
  readonly status: KycStatus;
  readonly message?: string | undefined;
}

export const identityCheckResultSchema = z.object({
  check: z.enum(["BVN", "NIN"]),
  status: kycStatusSchema,
  message: z.string().max(200).optional(),
});
