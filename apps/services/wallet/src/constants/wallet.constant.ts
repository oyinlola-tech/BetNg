export const WALLET_COMMAND = Object.freeze({
  DEPOSIT_FUNDS: "wallet.depositFunds",
  WITHDRAW_FUNDS: "wallet.withdrawFunds",
  POST_ENTRY: "wallet.postEntry",
});

export type WalletCommandType =
  (typeof WALLET_COMMAND)[keyof typeof WALLET_COMMAND];

export const WALLET_QUERY = Object.freeze({
  GET_WALLET: "wallet.getWallet",
  LIST_TRANSACTIONS: "wallet.listTransactions",
  LIST_SHOP_TRANSACTIONS: "wallet.listShopTransactions",
  GET_WALLET_OVERVIEW: "wallet.getWalletOverview",
});

export type WalletQueryType = (typeof WALLET_QUERY)[keyof typeof WALLET_QUERY];

export const WALLET_PROCEDURE = Object.freeze({
  DEBIT: "wallet.debit",
  CREDIT: "wallet.credit",
  GET_BALANCE: "wallet.getBalance",
});

export const OWNER_TYPES = Object.freeze(["CUSTOMER", "SHOP"] as const);

/** What `wallet.credit` accepts. The opening grants are excluded: only account opening posts them. */
export const CREDIT_TYPES = Object.freeze([
  "DEPOSIT",
  "BET_PAYOUT",
  "BET_REFUND",
  "TICKET_SALE",
  "CASH_IN",
  "ADJUSTMENT",
] as const);

export const DEBIT_TYPES = Object.freeze([
  "WITHDRAWAL",
  "BET_STAKE",
  "TICKET_PAYOUT",
  "TICKET_CANCEL",
  "CASH_OUT",
  "ADJUSTMENT",
] as const);

/** Counter transactions: shop floats only, and each must name its cashier in `actor_id`. */
export const SHOP_ENTRY_TYPES = Object.freeze([
  "TICKET_SALE",
  "TICKET_PAYOUT",
  "TICKET_CANCEL",
  "CASH_IN",
  "CASH_OUT",
] as const);

export const OPENING_IDEMPOTENCY_KEY = "opening";

export const IDEMPOTENCY_KEY_HEADER = "idempotency-key";

export const DEFAULT_LIST_LIMIT = 50;

export const MAX_LIST_LIMIT = 200;

export const WALLET_PERMISSION = Object.freeze({
  ADMIN_READ: "wallet:read",
  SHOP_TRANSACTIONS_READ: "transactions:read",
});
