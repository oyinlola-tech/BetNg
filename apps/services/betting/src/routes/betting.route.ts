/**
 * Betting service routes.
 */

import { API_PREFIX } from "@betng/contracts";
import { created, json } from "@betng/service-kit";
import type { HttpRouter } from "@betng/service-kit";
import type { BettingController } from "../controllers/index.js";

/**
 * Binds the betting endpoints to a router.
 *
 * @param router - The router the service dispatches through.
 * @param controller - The handlers to bind.
 */
export function registerBettingRoutes(
  router: HttpRouter,
  controller: BettingController,
): void {
  router.post(`${API_PREFIX}/bets`, created(controller.placeBet));
  router.get(`${API_PREFIX}/bets`, json(controller.listBets));
  router.get(`${API_PREFIX}/bets/:id`, json(controller.getBet));
}
