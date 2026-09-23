import { z } from "zod";
import type { CustomerLoginRequest, CustomerRegisterRequest, PasswordResetRequest, VerifyEmailRequest } from "@betng/contracts";

/* Mirrors packages/contracts/src/auth: the contracts entry pulls server-side validation into a browser bundle, so clients import its types only. */

const email = z.email("Enter a valid email address.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(128),
}) satisfies z.ZodType<CustomerLoginRequest>;

export const registerSchema = z.object({
  displayName: z.string().trim().min(2, "Enter at least 2 characters.").max(60, "Keep it under 60 characters."),
  email,
  phone: z
    .string()
    .trim()
    .max(20, "Keep it under 20 characters.")
    .regex(/^[+\d][\d\s-]*$/, "Use digits only, with an optional +.")
    .optional()
    .or(z.literal("")),
  password: z.string().min(12, "Use at least 12 characters.").max(128),
  acceptTerms: z.boolean().refine((v) => v, "Accept the terms to continue."),
});

export type RegisterValues = z.infer<typeof registerSchema>;

export function toRegisterRequest(values: RegisterValues): CustomerRegisterRequest {
  return {
    email: values.email,
    password: values.password,
    displayName: values.displayName,
    ...(values.phone === undefined || values.phone === "" ? {} : { phone: values.phone }),
  };
}

export const verifySchema = z.object({
  email,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
}) satisfies z.ZodType<VerifyEmailRequest>;

export const forgotSchema = z.object({ email }) satisfies z.ZodType<PasswordResetRequest>;

const newPassword = z.string().min(12, "Use at least 12 characters.").max(128, "Keep it under 128 characters.");

function matching<T extends { readonly newPassword: string; readonly confirmPassword: string }>(values: T): boolean {
  return values.newPassword === values.confirmPassword;
}

const mismatch = { message: "The passwords do not match.", path: ["confirmPassword"] };

export const resetConfirmSchema = z
  .object({
    email,
    code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
    newPassword,
    confirmPassword: z.string().min(1, "Enter the new password again."),
  })
  .refine(matching, mismatch);

export type ResetConfirmValues = z.infer<typeof resetConfirmSchema>;

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(128),
    newPassword,
    confirmPassword: z.string().min(1, "Enter the new password again."),
  })
  .refine(matching, mismatch)
  .refine((values) => values.currentPassword !== values.newPassword, { message: "Choose a password different from the current one.", path: ["newPassword"] });

export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;

export const TOTP_PATTERN = /^\d{6}$/;
export const BACKUP_CODE_PATTERN = /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/;
