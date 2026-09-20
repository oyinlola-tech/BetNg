/**
 * The wallet service's CQRS type discriminators.
 */

export const WALLET_COMMAND = Object.freeze({
  DEPOSIT_FUNDS: "wallet.deposit-funds",
  WITHDRAW_FUNDS: "wallet.withdraw-funds",
});

export type WalletCommandType =
  (typeof WALLET_COMMAND)[keyof typeof WALLET_COMMAND];

export const WALLET_QUERY = Object.freeze({
  GET_WALLET: "wallet.get-wallet",
  LIST_TRANSACTIONS: "wallet.list-transactions",
});

export type WalletQueryType =
  (typeof WALLET_QUERY)[keyof typeof WALLET_QUERY];
