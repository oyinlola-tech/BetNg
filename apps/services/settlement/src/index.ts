/**
 * @betng/settlement-service
 *
 * Reads completed match results, determines winning selections and records
 * the simulated payout for each bet.
 */

export { createApp } from "./app.js";
export type { SettlementApp } from "./app.js";
export {
  DEFAULT_PORT,
  loadSettlementConfig,
  SERVICE_NAME,
  SERVICE_VERSION,
} from "./configs/index.js";
export { createInMemorySettlementRepository } from "./repositories/index.js";
