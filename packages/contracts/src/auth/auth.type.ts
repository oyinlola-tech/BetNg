import { z } from "@zudojs/validation";
import { brandedIdSchema, isoTimestampSchema, type UserId } from "../common/index.js";

export const customerRegisterRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(60),
  phone: z.string().max(20).optional(),
});

export type CustomerRegisterRequest = z.infer<typeof customerRegisterRequestSchema>;

export const customerLoginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

export type CustomerLoginRequest = z.infer<typeof customerLoginRequestSchema>;

export interface CustomerProfile {
  readonly id: UserId;
  readonly email: string;
  readonly displayName: string;
  readonly phone?: string | undefined;
  readonly status: "ACTIVE" | "SUSPENDED";
  readonly createdAt: string;
  readonly lastActiveAt: string;
}

export const customerProfileSchema = z.object({
  id: brandedIdSchema<"UserId">(),
  email: z.email(),
  displayName: z.string().min(1).max(60),
  phone: z.string().max(20).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  createdAt: isoTimestampSchema,
  lastActiveAt: isoTimestampSchema,
});

/** A bearer token and the profile it belongs to. */
export interface CustomerSession {
  readonly token: string;
  readonly expiresAt: string;
  readonly user: CustomerProfile;
}

export const customerSessionSchema = z.object({
  token: z.string().min(16),
  expiresAt: isoTimestampSchema,
  user: customerProfileSchema,
});

/** Registration answers with where the six-digit code went; the session starts after `POST /auth/verify`. */
export interface RegistrationPending {
  readonly email: string;
  readonly verificationRequired: true;
  readonly expiresAt: string;
}

export const registrationPendingSchema = z.object({
  email: z.email(),
  verificationRequired: z.literal(true),
  expiresAt: isoTimestampSchema,
});

export const verifyEmailRequestSchema = z.object({ email: z.email(), code: z.string().regex(/^\d{6}$/) });

export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const passwordResetRequestSchema = z.object({ email: z.email() });

export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
