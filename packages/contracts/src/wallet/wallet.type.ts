/**
 * Wallet contracts, owned by the wallet service.
 *
 * SIMULATED FUNCTIONALITY ONLY.
 *
 * This wallet holds play-money balances for a portfolio demonstration. It
 * does not connect to a payment provider, hold customer funds, or represent
 * any real-world obligation. A deposit moves a number in a database; no
 * money changes hands. Do not repurpose these contracts for a system that
 * handles real funds without a full compliance review.
 */

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

/** The body of `POST /api/v1/wallet/deposit`. Simulated. */
export const depositRequestSchema = z.object({
  userId: brandedIdSchema<"UserId">(),
  amount: minorUnitsSchema.min(1),
  currency: currencySchema.default("NGN"),
});

export type DepositRequest = z.infer<typeof depositRequestSchema>;

/** The body of `POST /api/v1/wallet/withdraw`. Simulated. */
export const withdrawRequestSchema = depositRequestSchema;

export type WithdrawRequest = z.infer<typeof withdrawRequestSchema>;
