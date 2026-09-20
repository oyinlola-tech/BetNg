/**
 * @betng/match-service/services/match/queries
 *
 * The read side of the match service. Every read the API serves goes
 * through a query and its handler, so the HTTP layer holds no data access
 * of its own.
 */

export { ListLeaguesQuery, ListLeaguesHandler } from "./listLeagues/index.js";
export { ListTeamsQuery, ListTeamsHandler } from "./listTeams/index.js";
export {
  ListFixturesQuery,
  ListFixturesHandler,
} from "./listFixtures/index.js";
export { ListMatchesQuery, ListMatchesHandler } from "./listMatches/index.js";
export { GetMatchQuery, GetMatchHandler } from "./getMatch/index.js";
