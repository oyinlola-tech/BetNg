/**
 * @betng/contracts/odds
 *
 * Markets, priced selections and the odds a match currently carries.
 */

export { selectionSchema } from "./selection.type.js";
export type { Selection } from "./selection.type.js";

export {
  marketSchema,
  marketStatusSchema,
  marketTypeSchema,
  matchOddsSchema,
} from "./market.type.js";
export type {
  Market,
  MarketStatus,
  MarketType,
  MatchOdds,
} from "./market.type.js";
