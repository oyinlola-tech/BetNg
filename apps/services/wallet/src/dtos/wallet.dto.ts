import type { Transaction, Wallet } from "@betng/contracts";

export interface LedgerEntryDto {
  readonly wallet: Wallet;
  readonly transaction: Transaction;
}

export interface TransactionListDto {
  readonly items: readonly Transaction[];
}
