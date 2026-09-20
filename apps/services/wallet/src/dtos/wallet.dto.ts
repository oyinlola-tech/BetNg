/**
 * The response shapes the wallet endpoints return.
 */

import type { Transaction, Wallet } from "@betng/contracts";

/** What a deposit or withdrawal answers with: the wallet and the entry. */
export interface LedgerEntryDto {
  readonly wallet: Wallet;
  readonly transaction: Transaction;
}

export interface TransactionListDto {
  readonly items: readonly Transaction[];
}
