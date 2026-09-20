/**
 * The betting service's CQRS type discriminators.
 */

export const BETTING_COMMAND = Object.freeze({
  PLACE_BET: "betting.place-bet",
});

export type BettingCommandType =
  (typeof BETTING_COMMAND)[keyof typeof BETTING_COMMAND];

export const BETTING_QUERY = Object.freeze({
  GET_BET: "betting.get-bet",
  LIST_BETS: "betting.list-bets",
});

export type BettingQueryType =
  (typeof BETTING_QUERY)[keyof typeof BETTING_QUERY];
