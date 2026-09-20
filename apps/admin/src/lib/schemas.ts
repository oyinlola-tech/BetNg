import { z } from "zod";
import type { AdminLoginRequest, CreateCashierRequest, CreateShopRequest, PlatformSettings } from "@betng/contracts";

/* Form-side mirrors of the contract schemas. The contracts package is server-side at runtime, so browser forms validate against these and the platform validates again. */

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(128),
}) satisfies z.ZodType<Omit<AdminLoginRequest, "code">>;

export type LoginValues = z.infer<typeof loginSchema>;

export const shopSchema = z.object({
  code: z
    .string()
    .min(3, "At least 3 characters.")
    .max(20)
    .regex(/^[A-Z0-9-]+$/, "Capitals, digits and dashes, e.g. BNG-LAG-005."),
  name: z.string().min(2, "Enter the shop name.").max(80),
  address: z.string().min(1, "Enter the address.").max(160),
  phone: z.string().min(7, "Enter a contact number.").max(20),
  email: z.email("Enter a valid email address."),
  ownerName: z.string().min(2, "Enter the owner's name.").max(80),
}) satisfies z.ZodType<CreateShopRequest>;

export type ShopValues = z.infer<typeof shopSchema>;

export const cashierSchema = z.object({
  username: z
    .string()
    .min(2, "At least 2 characters.")
    .max(40)
    .regex(/^[a-z0-9._-]+$/, "Lowercase letters, digits, dot, dash or underscore."),
  displayName: z.string().min(2, "Enter the cashier's name.").max(60),
  role: z.enum(["OWNER", "MANAGER", "CASHIER"]),
}) satisfies z.ZodType<CreateCashierRequest>;

export type CashierValues = z.infer<typeof cashierSchema>;

const naira = (label: string) => z.number({ error: `Enter ${label}.` }).positive(`${label} must be above zero.`);

/** Money is edited in naira and converted to kobo on submit. */
export const settingsSchema = z
  .object({
    minStake: naira("a minimum stake"),
    maxStake: naira("a maximum stake"),
    maxPayout: naira("a maximum payout"),
    maxSelections: z.number().int().min(1).max(40),
    bettingCloseSeconds: z.number().int().min(0).max(600),
    ticketExpiryDays: z.number().int().min(1).max(365),
    exposureLimit: z.number().min(0),
    maintenanceMode: z.boolean(),
  })
  .refine((v) => v.minStake < v.maxStake, { path: ["maxStake"], message: "Maximum stake must be above the minimum." }) satisfies z.ZodType<PlatformSettings>;

export type SettingsValues = z.infer<typeof settingsSchema>;
