/**
 * Betting service routes.
 */

import { API_PREFIX } from "@betng/contracts";
import { created, json, type HttpRouter } from "@betng/service-kit";
import type { BetControllers } from "../controllers/betController.js";

export function registerBettingRoutes(
  router: HttpRouter,
  controllers: BetControllers,
): void {
  router.post(`${API_PREFIX}/bets`, created(controllers.placeBet));
  router.get(`${API_PREFIX}/bets`, json(controllers.listBets));
  router.get(`${API_PREFIX}/bets/:id`, json(controllers.getBet));
}
