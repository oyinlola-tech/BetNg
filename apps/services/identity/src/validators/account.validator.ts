import {
  accountDeletionRequestSchema,
  bvnVerifyRequestSchema,
  channelPreferencesSchema,
  kycReviewDecisionSchema,
  kycStatusSchema,
  kycSubmitDocumentRequestSchema,
  kycUploadRequestSchema,
  limitKindSchema,
  ninVerifyRequestSchema,
  passwordChangeRequestSchema,
  passwordResetConfirmRequestSchema,
  registerPushDeviceRequestSchema,
  selfExcludeRequestSchema,
  setLimitRequestSchema,
  totpCodeSchema,
  backupCodeSchema,
  twoFactorChallengeRequestSchema,
  twoFactorConfirmRequestSchema,
  twoFactorDisableRequestSchema,
} from "@betng/contracts";
import { z } from "@zudojs/validation";

export const twoFactorChallengeValidator = twoFactorChallengeRequestSchema.extend({ challengeId: z.string().min(16).max(128) }).strict();
export const twoFactorConfirmValidator = twoFactorConfirmRequestSchema.extend({ enrollmentId: z.uuid() }).strict();
export const twoFactorDisableValidator = twoFactorDisableRequestSchema.strict();
export const backupCodesRequestValidator = z.strictObject({ code: z.union([totpCodeSchema, backupCodeSchema]) });

export const passwordResetConfirmValidator = passwordResetConfirmRequestSchema.strict();
export const passwordChangeValidator = passwordChangeRequestSchema.strict();

export const accountDeletionValidator = accountDeletionRequestSchema.extend({ reason: z.string().trim().max(500).optional() }).strict();

export const idempotencyKeyValidator = z.string().regex(/^[A-Za-z0-9_.:-]{8,120}$/u);

export const channelPreferencesUpdateValidator = z.strictObject({ channels: channelPreferencesSchema.shape.channels });

export const registerPushDeviceValidator = registerPushDeviceRequestSchema
  .extend({ label: z.string().trim().min(1).max(80), token: z.string().min(16).max(4096).regex(/^[\x21-\x7e]+$/u) })
  .strict();

export const kycUploadValidator = kycUploadRequestSchema
  .extend({ fileName: z.string().trim().min(1).max(200).regex(/^[^\p{Cc}\\/]+$/u, "Use a plain file name.") })
  .strict();
export const kycSubmitValidator = kycSubmitDocumentRequestSchema.extend({ uploadId: z.uuid() }).strict();
export const bvnVerifyValidator = bvnVerifyRequestSchema.strict();
export const ninVerifyValidator = ninVerifyRequestSchema.strict();

export const kycReviewValidator = kycReviewDecisionSchema.extend({ reason: z.string().trim().min(4).max(300) }).strict();

const page = z.coerce.number().int().min(1).max(100_000).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(20);
const search = z.string().trim().min(1).max(80).optional();

export const kycQueueQueryValidator = z.strictObject({ page, pageSize, search, status: kycStatusSchema.default("PENDING") });

export const responsibleGamingQueryValidator = z.strictObject({
  page,
  pageSize,
  search,
  flag: z.enum(["SELF_EXCLUDED", "LIMIT_BREACH_ATTEMPT", "LIMIT_RAISED", "LONG_SESSION"]).optional(),
});

export const setLimitValidator = setLimitRequestSchema.strict();
export const limitKindParamValidator = limitKindSchema;
export const selfExcludeValidator = selfExcludeRequestSchema.strict();

export const limitsCheckPayloadValidator = z.strictObject({
  userId: z.uuid(),
  action: z.enum(["DEPOSIT", "BET", "WITHDRAWAL"]),
  amount: z.int().min(1).max(Number.MAX_SAFE_INTEGER),
});

export const kycStatusPayloadValidator = z.strictObject({ userId: z.uuid() });
