/**
 * Ledger contracts, owned by the wallet service.
 *
 * The ledger is append-only: a balance is the sum of its entries, so a
 * correction is a new compensating entry, never an edit.
 */

import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  currencySchema,
  isoTimestampSchema,
  minorUnitsSchema,
  type Currency,
  type TransactionId,
  type WalletId,
} from "../common/index.js";

export const transactionTypeSchema = z.enum([
  "DEPOSIT",
  "WITHDRAWAL",
  "BET_STAKE",
  "BET_PAYOUT",
  "BET_REFUND",
]);

export type TransactionType = z.infer<typeof transactionTypeSchema>;

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
  readonly balanceAfter: number;
  /**
   * The domain object that caused this entry: a bet identifier for
   * `BET_STAKE`, a settlement identifier for `BET_PAYOUT`. Absent for a
   * deposit or a withdrawal.
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
