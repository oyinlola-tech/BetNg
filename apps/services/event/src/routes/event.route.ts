/**
 * Event service routes.
 *
 * REST here is a companion to the live stream, not a substitute: it answers
 * "where has this channel got to?" so a reconnecting client knows whether it
 * missed anything. The events themselves arrive over WebSocket at `/live`.
 */

import { API_PREFIX } from "@betng/contracts";
import { json } from "@betng/service-kit";
import type { HttpRouter } from "@betng/service-kit";
import type { EventController } from "../controllers/index.js";

/**
 * Binds the event endpoints to a router.
 *
 * @param router - The router the service dispatches through.
 * @param controller - The handlers to bind.
 */
export function registerEventRoutes(
  router: HttpRouter,
  controller: EventController,
): void {
  router.get(
    `${API_PREFIX}/matches/:matchId/channel`,
    json(controller.getMatchChannel),
  );
}
