/**
 * Simulated balances, simulated deposits and withdrawals, and the
 * append-only transaction ledger.
 *
 * SIMULATED FUNCTIONALITY ONLY: this service holds no real funds and
 * connects to no payment provider.
 */

export { createApp } from "./app.js";
export type { WalletApp } from "./app.js";
export {
  DEFAULT_PORT,
  loadWalletConfig,
  SERVICE_NAME,
  SERVICE_VERSION,
} from "./configs/index.js";
export { createInMemoryWalletRepository } from "./repositories/index.js";
