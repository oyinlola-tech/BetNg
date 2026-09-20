import { API_PREFIX } from "@betng/contracts";
import { json } from "@betng/service-kit";
import type { HttpRouter } from "@betng/service-kit";
import type { SettlementController } from "../controllers/index.js";

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
