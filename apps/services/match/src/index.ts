/**
 * @betng/match-service
 *
 * Leagues, teams, fixtures, matchdays and the match lifecycle.
 */

export { createApp } from "./app.js";
export type { MatchApp } from "./app.js";
export {
  DEFAULT_PORT,
  loadMatchConfig,
  SERVICE_NAME,
  SERVICE_VERSION,
} from "./configs/index.js";
export { DEMO_IDS } from "./models/index.js";
