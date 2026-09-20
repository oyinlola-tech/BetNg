/**
 * @betng/contracts/betting
 *
 * Bets, their legs and the payloads that create and query them.
 */

export { betSelectionSchema } from "./betSelection.type.js";
export type { BetSelection } from "./betSelection.type.js";

export {
  betSchema,
  betStatusSchema,
  listBetsQuerySchema,
  placeBetRequestSchema,
} from "./bet.type.js";
export type {
  Bet,
  BetStatus,
  ListBetsQuery,
  PlaceBetRequest,
} from "./bet.type.js";
