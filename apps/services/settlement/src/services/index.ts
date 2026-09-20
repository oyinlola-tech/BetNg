/**
 * @betng/settlement-service/services
 *
 * The application services, each registering its own CQRS handlers.
 */

export { registerSettlementService } from "./settlement/index.js";
export type { SettlementServiceConfig } from "./settlement/index.js";
