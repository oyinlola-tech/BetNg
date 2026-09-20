/**
 * @betng/wallet-service/services
 *
 * The application services, each registering its own CQRS handlers.
 */

export { registerWalletService } from "./wallet/index.js";
export type { WalletServiceConfig } from "./wallet/index.js";
