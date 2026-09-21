import { API_PREFIX } from "@betng/contracts";
import { created, json } from "@betng/service-kit";
import type { HttpRouter } from "@betng/service-kit";
import type { AdminController, MatchController } from "../controllers/index.js";

export function registerMatchRoutes(
  router: HttpRouter,
  controller: MatchController,
): void {
  router.get(`${API_PREFIX}/leagues`, json(controller.listLeagues));
  router.get(
    `${API_PREFIX}/leagues/:id/standings`,
    json(controller.getStandings),
  );
  router.get(`${API_PREFIX}/leagues/:id/scorers`, json(controller.listScorers));
  router.get(`${API_PREFIX}/teams`, json(controller.listTeams));
  router.get(`${API_PREFIX}/fixtures`, json(controller.listFixtures));
  router.get(`${API_PREFIX}/matches`, json(controller.listMatches));
  router.get(`${API_PREFIX}/matches/:id`, json(controller.getMatch));
  router.get(
    `${API_PREFIX}/matches/:id/events`,
    json(controller.listMatchEvents),
  );
  router.get(`${API_PREFIX}/matches/:id/stats`, json(controller.getMatchStats));
  router.get(
    `${API_PREFIX}/matches/:id/lineups`,
    json(controller.getMatchLineups),
  );
  router.get(
    `${API_PREFIX}/matches/:id/head-to-head`,
    json(controller.getHeadToHead),
  );
  router.get(`${API_PREFIX}/search`, json(controller.search));
  router.get(`${API_PREFIX}/config`, json(controller.getPublicConfig));
  router.get(`${API_PREFIX}/results`, json(controller.listResults));
}

export function registerAdminRoutes(
  router: HttpRouter,
  controller: AdminController,
): void {
  router.get(`${API_PREFIX}/admin/leagues`, json(controller.listLeagues));
  router.post(`${API_PREFIX}/admin/leagues`, created(controller.createLeague));
  router.get(`${API_PREFIX}/admin/teams`, json(controller.listTeams));
  router.post(`${API_PREFIX}/admin/teams`, created(controller.createTeam));
  router.patch(`${API_PREFIX}/admin/teams/:id`, json(controller.updateTeam));
  router.get(`${API_PREFIX}/admin/fixtures`, json(controller.listFixtures));
  router.post(
    `${API_PREFIX}/admin/fixtures`,
    created(controller.createFixture),
  );
  router.get(`${API_PREFIX}/admin/matches/:id`, json(controller.getMatch));
  router.post(
    `${API_PREFIX}/admin/matches/:id/actions`,
    json(controller.performMatchAction),
  );
}
