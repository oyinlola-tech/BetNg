/**
 * Match service routes.
 *
 * Everything the platform exposes publicly sits behind `/api/v1`. `/health`
 * and `/ready` are registered by the service kit and deliberately sit
 * outside it: they describe the process, not the domain.
 */

import { API_PREFIX } from "@betng/contracts";
import { json, type HttpRouter } from "@betng/service-kit";
import type { MatchControllers } from "../controllers/matchController.js";

export function registerMatchRoutes(
  router: HttpRouter,
  controllers: MatchControllers,
): void {
  router.get(`${API_PREFIX}/leagues`, json(controllers.listLeagues));
  router.get(`${API_PREFIX}/teams`, json(controllers.listTeams));
  router.get(`${API_PREFIX}/fixtures`, json(controllers.listFixtures));
  router.get(`${API_PREFIX}/matches`, json(controllers.listMatches));
  router.get(`${API_PREFIX}/matches/:id`, json(controllers.getMatch));
}
