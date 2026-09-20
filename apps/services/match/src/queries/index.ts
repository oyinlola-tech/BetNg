/**
 * @betng/match-service/queries
 *
 * The read side of the match service. Every read the API serves goes
 * through a query and its handler, so the HTTP layer holds no data access
 * of its own.
 */

export { ListLeaguesHandler, ListLeaguesQuery } from "./list-leagues/index.js";
export { ListTeamsHandler, ListTeamsQuery } from "./list-teams/index.js";
export {
  ListFixturesHandler,
  ListFixturesQuery,
} from "./list-fixtures/index.js";
export { ListMatchesHandler, ListMatchesQuery } from "./list-matches/index.js";
export { GetMatchHandler, GetMatchQuery } from "./get-match/index.js";
