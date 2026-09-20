/**
 * @betng/contracts/match
 *
 * Competition structure and the lifecycle of a single virtual match.
 */

export { leagueSchema, teamSchema } from "./league.type.js";
export type { League, Team } from "./league.type.js";

export { fixtureSchema } from "./fixture.type.js";
export type { Fixture } from "./fixture.type.js";

export {
  listMatchesQuerySchema,
  listTeamsQuerySchema,
  matchSchema,
  matchScoreSchema,
  matchStatusSchema,
} from "./match.type.js";
export type {
  ListMatchesQuery,
  ListTeamsQuery,
  Match,
  MatchScore,
  MatchStatus,
} from "./match.type.js";

export {
  matchEventSchema,
  matchEventTypeSchema,
  matchSideSchema,
} from "./matchEvent.type.js";
export type {
  MatchEvent,
  MatchEventType,
  MatchSide,
} from "./matchEvent.type.js";
