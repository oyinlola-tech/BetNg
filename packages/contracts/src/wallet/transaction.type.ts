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
  readonly amount: number;
  readonly currency: Currency;
  readonly balanceAfter: number;
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
