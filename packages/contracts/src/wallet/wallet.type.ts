import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  currencySchema,
  isoTimestampSchema,
  minorUnitsSchema,
  type Currency,
  type UserId,
  type WalletId,
} from "../common/index.js";

export interface Wallet {
  readonly id: WalletId;
  readonly userId: UserId;
  readonly balance: number;
  /**
   * The part of `balance` committed to bets that have not settled.
   *
   * Available balance is `balance - reserved`.
   */
  readonly reserved: number;
  /** Withdrawals already debited from `balance` and still with the payment provider. Absent where payments are off. */
  readonly pending?: number | undefined;
  readonly currency: Currency;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const walletSchema = z.object({
  id: brandedIdSchema<"WalletId">(),
  userId: brandedIdSchema<"UserId">(),
  balance: minorUnitsSchema.min(0),
  reserved: minorUnitsSchema.min(0),
  pending: minorUnitsSchema.min(0).optional(),
  currency: currencySchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const depositRequestSchema = z.object({
  userId: brandedIdSchema<"UserId">(),
  amount: minorUnitsSchema.min(1),
  currency: currencySchema.default("NGN"),
});

export type DepositRequest = z.infer<typeof depositRequestSchema>;

export const withdrawRequestSchema = depositRequestSchema;

export type WithdrawRequest = z.infer<typeof withdrawRequestSchema>;
