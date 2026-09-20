/**
 * @betng/event-service/controllers
 *
 * The event service's two client-facing surfaces: the WebSocket protocol and
 * the read-only REST routes.
 */

export { createLiveController } from "./live.controller.js";
export type {
  LiveController,
  LiveControllerOptions,
} from "./live.controller.js";

export { createEventController } from "./event.controller.js";
export type { EventController } from "./event.controller.js";
