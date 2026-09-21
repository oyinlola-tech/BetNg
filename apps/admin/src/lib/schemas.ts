import { z } from "zod";
import type { AdminLoginRequest, CreateCashierRequest, CreateShopRequest } from "@betng/contracts";
import { currentCurrency, formatMoney, parseMoney } from "@betng/ui-core";

/* Form-side mirrors of the contract schemas: forms validate against these for fast feedback and the platform validates again. */

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
    .regex(/^[A-Z0-9-]+$/, "Capitals, digits and dashes only."),
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

/** Typed amounts stay text in the form and become minor units through `parseMoney`; no float touches them. */
export function moneyText(label: string, options: { readonly allowZero?: boolean } = {}) {
  return z
    .string()
    .trim()
    .min(1, `Enter ${label}.`)
    .refine((text) => parseMoney(text) !== undefined, "Enter an amount, for example 2500 or 2500.50.")
    .refine((text) => options.allowZero === true || (parseMoney(text) ?? 0) > 0, "The amount must be above zero.");
}

export function toMinor(text: string): number {
  return parseMoney(text) ?? 0;
}

export function toMoneyText(minorUnits: number): string {
  return formatMoney(minorUnits, { currency: { ...currentCurrency(), symbol: "" } });
}

const wholeNumber = (label: string, min: number, max: number) => z.number({ error: `Enter ${label}.` }).int("Whole numbers only.").min(min, `At least ${String(min)}.`).max(max, `At most ${String(max)}.`);

export const settingsSchema = z
  .object({
    minStake: moneyText("a minimum stake"),
    maxStake: moneyText("a maximum stake"),
    maxPayout: moneyText("a maximum payout"),
    exposureLimit: moneyText("an exposure limit", { allowZero: true }),
    maxSelections: wholeNumber("the most selections on a bet", 1, 40),
    bettingCloseSeconds: wholeNumber("seconds", 0, 600),
    ticketExpiryDays: wholeNumber("days", 1, 365),
    maintenanceMode: z.boolean(),
  })
  .refine((v) => toMinor(v.minStake) < toMinor(v.maxStake), { path: ["maxStake"], message: "Maximum stake must be above the minimum." });

export type SettingsValues = z.infer<typeof settingsSchema>;

export const RISK_LIMIT_FIELDS = ["minStake", "maxStakePerBet", "maxPayoutPerBet", "maxLiabilityPerSelection", "maxLiabilityPerMarket", "maxLiabilityPerMatch"] as const;

export type RiskLimitField = (typeof RISK_LIMIT_FIELDS)[number];

export const riskLimitsSchema = z
  .object({
    minStake: moneyText("a minimum stake"),
    maxStakePerBet: moneyText("a maximum stake"),
    maxPayoutPerBet: moneyText("a maximum payout"),
    maxLiabilityPerSelection: moneyText("a selection limit"),
    maxLiabilityPerMarket: moneyText("a market limit"),
    maxLiabilityPerMatch: moneyText("a match limit"),
  })
  .refine((v) => toMinor(v.minStake) < toMinor(v.maxStakePerBet), { path: ["maxStakePerBet"], message: "Maximum stake must be above the minimum." });

export type RiskLimitsValues = z.infer<typeof riskLimitsSchema>;

export const commissionSchema = z.object({
  shopId: z.string(),
  shopSharePercent: z.number({ error: "Enter a percentage." }).min(0, "At least 0.").max(100, "At most 100."),
});

export type CommissionValues = z.infer<typeof commissionSchema>;

const rating = z.number({ error: "Enter a rating." }).int("Whole numbers only.").min(1, "At least 1.").max(99, "At most 99.");

export const teamSchema = z.object({
  name: z.string().trim().min(1, "Enter the team name.").max(120),
  shortName: z.string().trim().min(2, "At least 2 characters.").max(12, "At most 12 characters."),
  active: z.boolean(),
  attack: rating,
  midfield: rating,
  defence: rating,
  goalkeeper: rating,
  pace: rating,
  finishing: rating,
  form: z.number({ error: "Enter a value." }).int("Whole numbers only.").min(-10, "At least -10.").max(10, "At most 10."),
});

export type TeamValues = z.infer<typeof teamSchema>;
