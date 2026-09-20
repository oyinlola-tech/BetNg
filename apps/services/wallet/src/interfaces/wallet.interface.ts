/**
 * The wallet service's data-access contract.
 *
 * SIMULATED FUNDS ONLY. Balances are play money for a portfolio
 * demonstration; no payment provider is involved and no real value moves.
 *
 * The ledger is append-only. `applyEntry` writes a transaction and derives
 * the new balance from it, so a balance is always explainable by the
 * entries that produced it. Nothing mutates a balance directly, and that is
 * the property worth keeping when PostgreSQL replaces the in-memory store.
 */

import type { Transaction, TransactionType, Wallet } from "@betng/contracts";

export interface LedgerEntry {
  readonly userId: string;
  readonly type: TransactionType;
  readonly amount: number;
  readonly reference?: string;
}

export interface LedgerResult {
  readonly wallet: Wallet;
  readonly transaction: Transaction;
}

export interface WalletRepository {
  findByUser(userId: string): Promise<Wallet | undefined>;
  ensureForUser(userId: string): Promise<Wallet>;
  listTransactions(userId: string): Promise<readonly Transaction[]>;
  /**
   * Appends one ledger entry and returns the resulting wallet.
   *
   * @throws {InsufficientFundsError} When the entry would overdraw.
   */
  applyEntry(entry: LedgerEntry): Promise<LedgerResult>;
}
