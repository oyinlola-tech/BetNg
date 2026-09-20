/**
 * Wallet domain contracts — owned by the wallet service.
 *
 * SIMULATED FUNCTIONALITY ONLY.
 *
 * This wallet holds play-money balances for a portfolio demonstration. It
 * does not connect to a payment provider, hold customer funds, or represent
 * any real-world obligation. `deposit` and `withdraw` move a number in a
 * database; no money changes hands. Do not repurpose these contracts for a
 * system that handles real funds without a full compliance review.
 */

import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  currencySchema,
  isoTimestampSchema,
  minorUnitsSchema,
  type Currency,
  type TransactionId,
  type UserId,
  type WalletId,
} from "../common/primitives.js";

export interface Wallet {
  readonly id: WalletId;
  readonly userId: UserId;
  /** Simulated balance in minor units. Never negative. */
  readonly balance: number;
  /**
   * The part of `balance` committed to bets that have not settled.
   *
   * Available balance is `balance - reserved`.
   */
  readonly reserved: number;
  readonly currency: Currency;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const walletSchema = z.object({
  id: brandedIdSchema<"WalletId">(),
  userId: brandedIdSchema<"UserId">(),
  balance: minorUnitsSchema.min(0),
  reserved: minorUnitsSchema.min(0),
  currency: currencySchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

/**
 * The kinds of entry the simulated ledger records.
 *
 * The ledger is append-only: a balance is the sum of its entries, so a
 * correction is a new compensating entry, never an edit.
 */
export const transactionTypeSchema = z.enum([
  /** Simulated top-up. No payment provider is involved. */
  "DEPOSIT",
  /** Simulated withdrawal. No payment provider is involved. */
  "WITHDRAWAL",
  /** Stake moved out of available balance when a bet was accepted. */
  "BET_STAKE",
  /** Winnings credited by the settlement service. */
  "BET_PAYOUT",
  /** Stake returned because a match was cancelled. */
  "BET_REFUND",
]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

/** One append-only ledger entry. */
export interface Transaction {
  readonly id: TransactionId;
  readonly walletId: WalletId;
  readonly type: TransactionType;
  /**
   * Signed amount in minor units: positive credits the wallet, negative
   * debits it. The sign is carried on the amount rather than implied by
   * `type`, so summing the ledger needs no per-type branching.
   */
  readonly amount: number;
  readonly currency: Currency;
  /** The wallet balance immediately after this entry was applied. */
  readonly balanceAfter: number;
  /**
   * The domain object that caused this entry — a bet id for `BET_STAKE`,
   * a settlement id for `BET_PAYOUT`. Absent for deposits and withdrawals.
   */
  readonly reference?: string;
  readonly createdAt: string;
}

export const transactionSchema = z.object({
  id: brandedIdSchema<"TransactionId">(),
  walletId: brandedIdSchema<"WalletId">(),
  type: transactionTypeSchema,
  amount: minorUnitsSchema,
  currency: currencySchema,
  balanceAfter: minorUnitsSchema.min(0),
  reference: z.string().max(120).optional(),
  createdAt: isoTimestampSchema,
});

/** The body of `POST /api/v1/wallet/deposit` — simulated. */
export const depositRequestSchema = z.object({
  userId: brandedIdSchema<"UserId">(),
  amount: minorUnitsSchema.min(1),
  currency: currencySchema.default("NGN"),
});
export type DepositRequest = z.infer<typeof depositRequestSchema>;

/** The body of `POST /api/v1/wallet/withdraw` — simulated. */
export const withdrawRequestSchema = depositRequestSchema;
export type WithdrawRequest = z.infer<typeof withdrawRequestSchema>;
