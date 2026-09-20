/**
 * Match service routes.
 *
 * Everything the platform exposes publicly sits behind `/api/v1`. The
 * service kit registers `/health` and `/ready`, which deliberately sit
 * outside the prefix because they describe the process, not the domain.
 */

import { API_PREFIX } from "@betng/contracts";
import { json } from "@betng/service-kit";
import type { HttpRouter } from "@betng/service-kit";
import type { MatchController } from "../controllers/index.js";

/**
 * Binds the match endpoints to a router.
 *
 * @param router - The router the service dispatches through.
 * @param controller - The handlers to bind.
 */
export function registerMatchRoutes(
  router: HttpRouter,
  controller: MatchController,
): void {
  router.get(`${API_PREFIX}/leagues`, json(controller.listLeagues));
  router.get(`${API_PREFIX}/teams`, json(controller.listTeams));
  router.get(`${API_PREFIX}/fixtures`, json(controller.listFixtures));
  router.get(`${API_PREFIX}/matches`, json(controller.listMatches));
  router.get(`${API_PREFIX}/matches/:id`, json(controller.getMatch));
}
