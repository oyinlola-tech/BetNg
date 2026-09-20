/**
 * In-memory implementation of {@link WalletRepository}.
 *
 * SIMULATED FUNDS ONLY. Not a database: it exists so the ledger path is
 * exercisable end to end before the wallet schema lands, and it is replaced
 * by a PostgreSQL implementation of the same interface.
 */

import { asId } from "@betng/contracts";
import type { Transaction, Wallet } from "@betng/contracts";
import { InsufficientFundsError } from "../errors/index.js";
import type {
  LedgerEntry,
  LedgerResult,
  WalletRepository,
} from "../interfaces/index.js";

/**
 * Creates the in-memory wallet repository.
 *
 * `now` is injected so tests are deterministic rather than dependent on the
 * wall clock.
 */
export function createInMemoryWalletRepository(
  now: () => Date = () => new Date(),
): WalletRepository {
  const wallets = new Map<string, Wallet>();
  const ledger = new Map<string, Transaction[]>();

  function ensure(userId: string): Wallet {
    const existing = wallets.get(userId);

    if (existing !== undefined) {
      return existing;
    }

    const timestamp = now().toISOString();

    const created: Wallet = {
      id: asId<"WalletId">(crypto.randomUUID()),
      userId: asId<"UserId">(userId),
      balance: 0,
      reserved: 0,
      currency: "NGN",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    wallets.set(userId, created);
    ledger.set(userId, []);

    return created;
  }

  return {
    findByUser: async (userId) => wallets.get(userId),

    ensureForUser: async (userId) => ensure(userId),

    listTransactions: async (userId) => ledger.get(userId) ?? [],

    applyEntry: async (entry: LedgerEntry): Promise<LedgerResult> => {
      const wallet = ensure(entry.userId);
      const balanceAfter = wallet.balance + entry.amount;

      if (balanceAfter < 0) {
        throw new InsufficientFundsError(wallet.balance, -entry.amount);
      }

      const timestamp = now().toISOString();

      const transaction: Transaction = {
        id: asId<"TransactionId">(crypto.randomUUID()),
        walletId: wallet.id,
        type: entry.type,
        amount: entry.amount,
        currency: wallet.currency,
        balanceAfter,
        ...(entry.reference === undefined
          ? {}
          : { reference: entry.reference }),
        createdAt: timestamp,
      };

      const updated: Wallet = {
        ...wallet,
        balance: balanceAfter,
        updatedAt: timestamp,
      };

      wallets.set(entry.userId, updated);
      ledger.get(entry.userId)?.push(transaction);

      return { wallet: updated, transaction };
    },
  };
}
