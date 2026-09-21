import { API_PREFIX } from "@betng/contracts";
import { json } from "@betng/service-kit";
import type { HttpRouter } from "@betng/service-kit";
import type { EventController } from "../controllers/index.js";

export function registerEventRoutes(
  router: HttpRouter,
  controller: EventController,
): void {
  router.get(
    `${API_PREFIX}/matches/:matchId/channel`,
    json(controller.getMatchChannel),
  );
}
