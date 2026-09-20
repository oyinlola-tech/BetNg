/**
 * Settlement service routes.
 */

import { API_PREFIX } from "@betng/contracts";
import { json } from "@betng/service-kit";
import type { HttpRouter } from "@betng/service-kit";
import type { SettlementController } from "../controllers/index.js";

/**
 * Binds the settlement endpoints to a router.
 *
 * @param router - The router the service dispatches through.
 * @param controller - The handlers to bind.
 */
export function registerSettlementRoutes(
  router: HttpRouter,
  controller: SettlementController,
): void {
  router.get(`${API_PREFIX}/settlements`, json(controller.listSettlements));
  router.get(
    `${API_PREFIX}/settlements/:betId`,
    json(controller.getSettlement),
  );
}
