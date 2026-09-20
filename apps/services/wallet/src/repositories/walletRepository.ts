/**
 * Wallet and ledger data access.
 *
 * SIMULATED FUNDS ONLY. Balances here are play money for a portfolio
 * demonstration; no payment provider is involved and no real value moves.
 *
 * The ledger is append-only: `applyEntry` writes a transaction and derives
 * the new balance from it, so a balance is always explainable by the entries
 * that produced it. Nothing mutates a balance directly, which is the one
 * property worth keeping when the PostgreSQL implementation replaces this
 * in-memory one.
 */

import type { wallet as walletContracts } from "@betng/contracts";

type Wallet = walletContracts.Wallet;
type Transaction = walletContracts.Transaction;
type TransactionType = walletContracts.TransactionType;

export interface LedgerEntry {
  readonly userId: string;
  readonly type: TransactionType;
  /** Signed: positive credits the wallet, negative debits it. */
  readonly amount: number;
  readonly reference?: string;
}

export interface WalletRepository {
  findByUser(userId: string): Promise<Wallet | undefined>;
  /** Returns the wallet, creating an empty one on first use. */
  ensureForUser(userId: string): Promise<Wallet>;
  listTransactions(userId: string): Promise<readonly Transaction[]>;
  /**
   * Appends one ledger entry and returns the resulting wallet.
   *
   * @throws {InsufficientFundsError} When the entry would overdraw.
   */
  applyEntry(entry: LedgerEntry): Promise<{
    readonly wallet: Wallet;
    readonly transaction: Transaction;
  }>;
}

/** Raised when a debit would take a simulated balance below zero. */
export class InsufficientFundsError extends Error {
  public readonly available: number;
  public readonly requested: number;

  public constructor(available: number, requested: number) {
    super(
      `The wallet holds ${String(available)} but ${String(requested)} was ` +
        `requested.`,
    );
    this.name = "InsufficientFundsError";
    this.available = available;
    this.requested = requested;
  }
}

export function createInMemoryWalletRepository(
  now: () => Date = () => new Date(),
): WalletRepository {
  const wallets = new Map<string, Wallet>();
  const ledger = new Map<string, Transaction[]>();

  function ensure(userId: string): Wallet {
    const existing = wallets.get(userId);
    if (existing !== undefined) return existing;

    const timestamp = now().toISOString();
    const created = {
      id: crypto.randomUUID(),
      userId,
      balance: 0,
      reserved: 0,
      currency: "NGN",
      createdAt: timestamp,
      updatedAt: timestamp,
    } as unknown as Wallet;

    wallets.set(userId, created);
    ledger.set(userId, []);
    return created;
  }

  return {
    findByUser: (userId) => Promise.resolve(wallets.get(userId)),

    ensureForUser: (userId) => Promise.resolve(ensure(userId)),

    listTransactions: (userId) => Promise.resolve(ledger.get(userId) ?? []),

    applyEntry: (entry) => {
      const wallet = ensure(entry.userId);
      const balanceAfter = wallet.balance + entry.amount;

      if (balanceAfter < 0) {
        throw new InsufficientFundsError(wallet.balance, -entry.amount);
      }

      const timestamp = now().toISOString();

      const transaction = {
        id: crypto.randomUUID(),
        walletId: wallet.id,
        type: entry.type,
        amount: entry.amount,
        currency: wallet.currency,
        balanceAfter,
        ...(entry.reference === undefined
          ? {}
          : { reference: entry.reference }),
        createdAt: timestamp,
      } as unknown as Transaction;

      const updated = {
        ...wallet,
        balance: balanceAfter,
        updatedAt: timestamp,
      } as Wallet;

      wallets.set(entry.userId, updated);
      (ledger.get(entry.userId) ?? []).push(transaction);

      return Promise.resolve({ wallet: updated, transaction });
    },
  };
}
