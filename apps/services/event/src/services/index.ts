/**
 * @betng/event-service/services
 *
 * The application services, each registering its own CQRS handlers.
 */

export { registerEventService } from "./event/index.js";
export type { EventServiceConfig } from "./event/index.js";
