export const BETTING_COMMAND = Object.freeze({
  PLACE_BET: "betting.placeBet",
  APPLY_SETTLEMENT: "betting.applySettlement",
  PAYOUT_TICKET: "betting.payoutTicket",
  CANCEL_TICKET: "betting.cancelTicket",
});

export type BettingCommandType =
  (typeof BETTING_COMMAND)[keyof typeof BETTING_COMMAND];

export const BETTING_QUERY = Object.freeze({
  GET_BET: "betting.getBet",
  LIST_BETS: "betting.listBets",
  GET_TICKET: "betting.getTicket",
  LIST_TICKETS: "betting.listTickets",
});

export type BettingQueryType =
  (typeof BETTING_QUERY)[keyof typeof BETTING_QUERY];

export const BETTING_PROCEDURE = Object.freeze({
  APPLY_SETTLEMENT: "betting.applySettlement",
});

export const PERMISSION = Object.freeze({
  USERS_READ: "users:read",
  TICKETS_SELL: "tickets:sell",
  TICKETS_CHECK: "tickets:check",
  TICKETS_PAYOUT: "tickets:payout",
  TICKETS_CANCEL: "tickets:cancel",
});

export const IDEMPOTENCY_KEY_HEADER = "idempotency-key";

export const MAX_LEGS = 20;

/** Lifecycles in which a match still takes bets. */
export const OPEN_LIFECYCLES: readonly string[] = Object.freeze([
  "BETTING_OPEN",
  "BETTING_ACTIVE",
]);

export const OPEN_MARKET_STATUS = "OPEN";

/**
 * The per-match placement lock. The peer deadline is short so that a whole
 * placement (risk, then the wallet and one retry of it) finishes inside the
 * lock's lifetime rather than outliving it.
 */
export const MATCH_LOCK = Object.freeze({
  keyPrefix: "lock:bet:match:",
  ttlMs: 5000,
  waitMs: 3000,
  retryEveryMs: 25,
});

export const PLACEMENT_PEER_TIMEOUT_MS = 1500;

export const TICKET = Object.freeze({
  /** No 0/O, 1/I: a code is read off paper and typed back in. */
  alphabet: "23456789ABCDEFGHJKLMNPQRSTUVWXYZ",
  codeLength: 10,
  codeAttempts: 5,
  validityDays: 90,
});

export const LIST_LIMIT = Object.freeze({
  betsDefault: 50,
  betsMax: 100,
  ticketsDefault: 100,
  ticketsMax: 200,
});

/** Upper bound of `total_odds numeric(12,2)`, in hundredths. */
export const MAX_TOTAL_ODDS_HUNDREDTHS = 999_999_999_999n;

export const AUDIT_ACTION = Object.freeze({
  TICKET_SOLD: "ticket_sold",
  TICKET_PAID: "ticket_paid",
  TICKET_CANCELLED: "ticket_cancelled",
});

/** Settlement and cancellation hold a row lock across one wallet call. */
export const MONEY_TRANSACTION = Object.freeze({
  timeout: 15_000,
  maxWait: 5000,
});
