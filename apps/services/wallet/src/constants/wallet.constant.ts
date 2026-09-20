/**
 * The wallet service's CQRS type discriminators.
 *
 * A command or query and its handler must agree on one string. Naming them
 * here means the bus registration and the handler cannot drift apart
 * without a compile error.
 */

export const WALLET_COMMAND = Object.freeze({
  DEPOSIT_FUNDS: "wallet.depositFunds",
  WITHDRAW_FUNDS: "wallet.withdrawFunds",
});

export type WalletCommandType =
  (typeof WALLET_COMMAND)[keyof typeof WALLET_COMMAND];

export const WALLET_QUERY = Object.freeze({
  GET_WALLET: "wallet.getWallet",
  LIST_TRANSACTIONS: "wallet.listTransactions",
});

export type WalletQueryType = (typeof WALLET_QUERY)[keyof typeof WALLET_QUERY];
