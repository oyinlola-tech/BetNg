/**
 * @betng/betting-service
 *
 * Bet placement, validation, status and the betting lifecycle.
 */

export { createApp } from "./app.js";
export type { BettingApp } from "./app.js";
export {
  DEFAULT_PORT,
  loadBettingConfig,
  SERVICE_NAME,
  SERVICE_VERSION,
} from "./configs/index.js";
export {
  calculatePotentialPayout,
  calculateTotalOdds,
} from "./utils/index.js";
