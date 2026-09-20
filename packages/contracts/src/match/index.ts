export { leagueSchema, teamColorsSchema, teamSchema } from "./league.type.js";
export type { League, Team, TeamColors } from "./league.type.js";

export { matchStatsSchema, sideStatsSchema } from "./matchStats.type.js";
export type { MatchStats, SideStats } from "./matchStats.type.js";

export {
  formResultSchema,
  standingRowSchema,
  standingsSchema,
  topScorerSchema,
} from "./standings.type.js";
export type {
  FormResult,
  StandingRow,
  Standings,
  TopScorer,
} from "./standings.type.js";

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
