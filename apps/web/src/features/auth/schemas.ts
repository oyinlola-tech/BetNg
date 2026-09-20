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
  password: z.string().min(8, "Use at least 8 characters.").max(128),
  acceptTerms: z.boolean().refine((v) => v, "Confirm you understand this is a simulation."),
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
