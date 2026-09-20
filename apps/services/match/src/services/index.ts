/**
 * @betng/match-service/services
 *
 * The application services, each registering its own CQRS handlers.
 */

export { registerMatchService } from "./match/index.js";
export type { MatchServiceConfig } from "./match/index.js";
