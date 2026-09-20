/**
 * @betng/contracts/wallet
 *
 * Simulated balances and the append-only transaction ledger.
 */

export {
  depositRequestSchema,
  walletSchema,
  withdrawRequestSchema,
} from "./wallet.type.js";
export type {
  DepositRequest,
  Wallet,
  WithdrawRequest,
} from "./wallet.type.js";

export {
  transactionSchema,
  transactionTypeSchema,
} from "./transaction.type.js";
export type { Transaction, TransactionType } from "./transaction.type.js";
