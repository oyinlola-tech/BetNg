/**
 * @betng/betting-service/services
 *
 * The application services, each registering its own CQRS handlers.
 */

export { registerBettingService } from "./betting/index.js";
export type { BettingServiceConfig } from "./betting/index.js";
