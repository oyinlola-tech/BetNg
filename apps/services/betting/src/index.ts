export { createApp, type BettingApp } from "./app.js";
export {
  loadBettingConfig,
  SERVICE_NAME,
  SERVICE_VERSION,
} from "./config/index.js";
export {
  calculatePotentialPayout,
  calculateTotalOdds,
} from "./controllers/betController.js";
