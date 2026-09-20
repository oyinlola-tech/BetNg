/**
 * @betng/tv/types
 *
 * The domain types this client renders.
 *
 * Re-exported from `@betng/contracts`, which is also what the services are
 * built against, so a contract change is a compile error here rather than a
 * surprise at runtime. Nothing is redefined locally.
 */

export type {
  Bet,
  BetSelection,
  BetStatus,
  Fixture,
  League,
  LiveEvent,
  LiveEventType,
  Market,
  Match,
  MatchOdds,
  MatchStatus,
  Selection,
  Team,
  Transaction,
  Wallet,
} from "@betng/contracts";
