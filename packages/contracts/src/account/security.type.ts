import { z } from "@zudojs/validation";
import { isoTimestampSchema, httpsUrlSchema } from "../common/index.js";

// Pending backend: identity service account-security routes. The TOTP secret and backup codes are generated and stored server-side.

export const passwordChangeRequestSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
});

export type PasswordChangeRequest = z.infer<typeof passwordChangeRequestSchema>;

export const passwordResetConfirmRequestSchema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(12).max(128),
});

export type PasswordResetConfirmRequest = z.infer<typeof passwordResetConfirmRequestSchema>;

export interface TwoFactorStatus {
  readonly enabled: boolean;
  readonly method?: "TOTP" | undefined;
  readonly enabledAt?: string | undefined;
  readonly backupCodesRemaining?: number | undefined;
  /** True for operators whose role requires it. */
  readonly required: boolean;
}

export const twoFactorStatusSchema = z.object({
  enabled: z.boolean(),
  method: z.literal("TOTP").optional(),
  enabledAt: isoTimestampSchema.optional(),
  backupCodesRemaining: z.int().min(0).optional(),
  required: z.boolean(),
});

/** Shown once, during enrollment only. */
export interface TwoFactorEnrollment {
  readonly enrollmentId: string;
  readonly otpauthUri: string;
  readonly manualKey: string;
  readonly expiresAt: string;
}

export const twoFactorEnrollmentSchema = z.object({
  enrollmentId: z.string().min(1),
  otpauthUri: z.string().startsWith("otpauth://totp/"),
  manualKey: z.string().regex(/^[A-Z2-7 ]{16,64}$/),
  expiresAt: isoTimestampSchema,
});

export const totpCodeSchema = z.string().regex(/^\d{6}$/, "Enter the six-digit code.");

export const backupCodeSchema = z.string().regex(/^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/, "Enter a backup code like ABCD-1234.");

export const twoFactorConfirmRequestSchema = z.object({ enrollmentId: z.string().min(1), code: totpCodeSchema });

export type TwoFactorConfirmRequest = z.infer<typeof twoFactorConfirmRequestSchema>;

export const twoFactorDisableRequestSchema = z.object({ password: z.string().min(1).max(128), code: z.union([totpCodeSchema, backupCodeSchema]) });

export type TwoFactorDisableRequest = z.infer<typeof twoFactorDisableRequestSchema>;

export interface BackupCodes {
  readonly codes: readonly string[];
  readonly generatedAt: string;
}

export const backupCodesSchema = z.object({ codes: z.array(backupCodeSchema).min(1).max(20), generatedAt: isoTimestampSchema });

/** A login that needs a second factor answers with this instead of a session. */
export interface TwoFactorChallenge {
  readonly challengeId: string;
  readonly methods: readonly ("TOTP" | "BACKUP_CODE")[];
  readonly expiresAt: string;
}

export const twoFactorChallengeSchema = z.object({
  challengeId: z.string().min(1),
  methods: z.array(z.enum(["TOTP", "BACKUP_CODE"])).min(1),
  expiresAt: isoTimestampSchema,
});

export const twoFactorChallengeRequestSchema = z.object({ challengeId: z.string().min(1), code: z.union([totpCodeSchema, backupCodeSchema]) });

export type TwoFactorChallengeRequest = z.infer<typeof twoFactorChallengeRequestSchema>;

export interface AccountSession {
  readonly id: string;
  readonly current: boolean;
  readonly device?: string | undefined;
  readonly browser?: string | undefined;
  readonly platform?: string | undefined;
  /** Approximate, as the platform supplies it; the client never derives location. */
  readonly location?: string | undefined;
  readonly createdAt: string;
  readonly lastActiveAt: string;
  readonly expiresAt: string;
}

export const accountSessionSchema = z.object({
  id: z.string().min(1),
  current: z.boolean(),
  device: z.string().max(80).optional(),
  browser: z.string().max(80).optional(),
  platform: z.string().max(80).optional(),
  location: z.string().max(80).optional(),
  createdAt: isoTimestampSchema,
  lastActiveAt: isoTimestampSchema,
  expiresAt: isoTimestampSchema,
});

export interface SessionRefresh {
  readonly expiresAt: string;
  /** Present only when the platform uses bearer tokens; cookie sessions are refreshed by the Set-Cookie header. */
  readonly token?: string | undefined;
}

export const sessionRefreshSchema = z.object({ expiresAt: isoTimestampSchema, token: z.string().min(16).optional() });

export const accountDeletionStatusSchema = z.enum(["NONE", "REQUESTED", "PENDING", "CANCELLED", "COMPLETED"]);

export type AccountDeletionStatus = z.infer<typeof accountDeletionStatusSchema>;

export interface AccountDeletion {
  readonly status: AccountDeletionStatus;
  readonly requestedAt?: string | undefined;
  readonly scheduledFor?: string | undefined;
  readonly cancellable: boolean;
  /** Why the platform cannot delete yet, e.g. an open bet or a pending withdrawal. */
  readonly blockers?: readonly string[] | undefined;
}

export const accountDeletionSchema = z.object({
  status: accountDeletionStatusSchema,
  requestedAt: isoTimestampSchema.optional(),
  scheduledFor: isoTimestampSchema.optional(),
  cancellable: z.boolean(),
  blockers: z.array(z.string().max(200)).optional(),
});

export const accountDeletionRequestSchema = z.object({ password: z.string().min(1).max(128), reason: z.string().max(500).optional() });

export type AccountDeletionRequest = z.infer<typeof accountDeletionRequestSchema>;

export const statementFormatSchema = z.enum(["PDF", "CSV"]);

export type StatementFormat = z.infer<typeof statementFormatSchema>;

export const statementRequestSchema = z.object({
  format: statementFormatSchema,
  from: z.iso.date(),
  to: z.iso.date(),
  types: z.array(z.string()).optional(),
});

export type StatementRequest = z.infer<typeof statementRequestSchema>;

/** Statements are generated by the platform; large ones are prepared asynchronously. */
export interface StatementJob {
  readonly id: string;
  readonly status: "QUEUED" | "READY" | "FAILED" | "EXPIRED";
  readonly format: StatementFormat;
  readonly from: string;
  readonly to: string;
  readonly downloadUrl?: string | undefined;
  readonly expiresAt?: string | undefined;
  readonly createdAt: string;
}

export const statementJobSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["QUEUED", "READY", "FAILED", "EXPIRED"]),
  format: statementFormatSchema,
  from: z.iso.date(),
  to: z.iso.date(),
  downloadUrl: httpsUrlSchema.optional(),
  expiresAt: isoTimestampSchema.optional(),
  createdAt: isoTimestampSchema,
});
