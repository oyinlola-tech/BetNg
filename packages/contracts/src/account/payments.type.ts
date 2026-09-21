import { z } from "@zudojs/validation";
import { currencySchema, isoTimestampSchema, minorUnitsSchema, type Currency, httpsUrlSchema } from "../common/index.js";

// Pending backend: the payments service. Providers (Paystack, Flutterwave, Bachs) are chosen and called server-side only.

export const paymentProviderSchema = z.enum(["PAYSTACK", "FLUTTERWAVE", "BACHS"]);

export type PaymentProvider = z.infer<typeof paymentProviderSchema>;

export const paymentMethodSchema = z.enum(["CARD", "BANK_TRANSFER", "USSD"]);

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const paymentStatusSchema = z.enum(["INITIATED", "PENDING", "PROCESSING", "CONFIRMED", "FAILED", "CANCELLED", "EXPIRED", "REVERSED"]);

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentDirectionSchema = z.enum(["DEPOSIT", "WITHDRAWAL"]);

export type PaymentDirection = z.infer<typeof paymentDirectionSchema>;

export const TERMINAL_PAYMENT_STATUSES: readonly PaymentStatus[] = ["CONFIRMED", "FAILED", "CANCELLED", "EXPIRED", "REVERSED"];

export interface PaymentRecord {
  readonly reference: string;
  readonly direction: PaymentDirection;
  readonly status: PaymentStatus;
  readonly amount: number;
  readonly fee?: number | undefined;
  readonly netAmount?: number | undefined;
  readonly currency: Currency;
  readonly method?: PaymentMethod | undefined;
  readonly provider?: PaymentProvider | undefined;
  readonly bankAccountId?: string | undefined;
  /** Safe to show the customer; never provider internals. */
  readonly failureReason?: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string | undefined;
}

export const paymentRecordSchema = z.object({
  reference: z.string().min(6).max(64),
  direction: paymentDirectionSchema,
  status: paymentStatusSchema,
  amount: minorUnitsSchema.min(1),
  fee: minorUnitsSchema.min(0).optional(),
  netAmount: minorUnitsSchema.min(0).optional(),
  currency: currencySchema,
  method: paymentMethodSchema.optional(),
  provider: paymentProviderSchema.optional(),
  bankAccountId: z.string().optional(),
  failureReason: z.string().max(200).optional(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  completedAt: isoTimestampSchema.optional(),
});

export const depositInitiateRequestSchema = z.object({
  amount: minorUnitsSchema.min(1),
  method: paymentMethodSchema,
  /** A path on the BetNG web origin; the platform builds the provider callback from its own allowlist. */
  returnPath: z.string().regex(/^\/[A-Za-z0-9/_\-?=&.]*$/).max(200).optional(),
});

export type DepositInitiateRequest = z.infer<typeof depositInitiateRequestSchema>;

export interface DepositInitiation {
  readonly payment: PaymentRecord;
  /** Hosted checkout on the provider; absent for methods confirmed out of band (bank transfer, USSD). */
  readonly checkoutUrl?: string | undefined;
  readonly instructions?: { readonly title: string; readonly lines: readonly string[] } | undefined;
  readonly expiresAt: string;
}

export const depositInitiationSchema = z.object({
  payment: paymentRecordSchema,
  checkoutUrl: httpsUrlSchema.optional(),
  instructions: z.object({ title: z.string(), lines: z.array(z.string()) }).optional(),
  expiresAt: isoTimestampSchema,
});

export const depositVerifyRequestSchema = z.object({ reference: z.string().min(6).max(64) });

export type DepositVerifyRequest = z.infer<typeof depositVerifyRequestSchema>;

export const withdrawalRequestSchema = z.object({
  amount: minorUnitsSchema.min(1),
  bankAccountId: z.string().min(1),
});

export type WithdrawalRequest = z.infer<typeof withdrawalRequestSchema>;

/** Fees and net amount as the platform will apply them; the client only displays this. */
export interface WithdrawalQuote {
  readonly amount: number;
  readonly fee: number;
  readonly netAmount: number;
  readonly currency: Currency;
  readonly expiresAt: string;
}

export const withdrawalQuoteSchema = z.object({
  amount: minorUnitsSchema.min(1),
  fee: minorUnitsSchema.min(0),
  netAmount: minorUnitsSchema.min(0),
  currency: currencySchema,
  expiresAt: isoTimestampSchema,
});

export interface Bank {
  readonly code: string;
  readonly name: string;
}

export const bankSchema = z.object({ code: z.string().min(2).max(10), name: z.string().min(2).max(80) });

export interface BankAccount {
  readonly id: string;
  readonly bankCode: string;
  readonly bankName: string;
  /** Always masked by the platform, e.g. `******1234`. */
  readonly accountNumberMasked: string;
  readonly accountName: string;
  readonly isDefault: boolean;
  readonly verified: boolean;
  readonly createdAt: string;
}

export const bankAccountSchema = z.object({
  id: z.string().min(1),
  bankCode: z.string().min(2).max(10),
  bankName: z.string().min(2).max(80),
  accountNumberMasked: z.string().regex(/^[*\d]{4,20}$/),
  accountName: z.string().min(1).max(120),
  isDefault: z.boolean(),
  verified: z.boolean(),
  createdAt: isoTimestampSchema,
});

export const bankAccountVerifyRequestSchema = z.object({
  bankCode: z.string().min(2).max(10),
  accountNumber: z.string().regex(/^\d{10}$/, "A NUBAN account number has 10 digits."),
});

export type BankAccountVerifyRequest = z.infer<typeof bankAccountVerifyRequestSchema>;

export interface BankAccountVerification {
  readonly verificationId: string;
  readonly bankCode: string;
  readonly accountName: string;
  readonly accountNumberMasked: string;
  readonly expiresAt: string;
}

export const bankAccountVerificationSchema = z.object({
  verificationId: z.string().min(1),
  bankCode: z.string(),
  accountName: z.string().min(1).max(120),
  accountNumberMasked: z.string(),
  expiresAt: isoTimestampSchema,
});

/** The account is saved from a completed name enquiry, never from a client-supplied account name. */
export const saveBankAccountRequestSchema = z.object({
  verificationId: z.string().min(1),
  makeDefault: z.boolean().default(false),
});

export type SaveBankAccountRequest = z.infer<typeof saveBankAccountRequestSchema>;

export interface PaymentHistoryQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly direction?: PaymentDirection;
  readonly status?: PaymentStatus;
}
