import type { MatchLifecycle, MatchStatus } from "@betng/contracts";

export const MATCH_QUERY = Object.freeze({
  LIST_LEAGUES: "match.listLeagues",
  LIST_TEAMS: "match.listTeams",
  LIST_FIXTURES: "match.listFixtures",
  LIST_MATCHES: "match.listMatches",
  GET_MATCH: "match.getMatch",
  LIST_MATCH_EVENTS: "match.listMatchEvents",
  GET_MATCH_STATS: "match.getMatchStats",
  LIST_RESULTS: "match.listResults",
  GET_STANDINGS: "match.getStandings",
  LIST_SCORERS: "match.listScorers",
  LIST_ADMIN_TEAMS: "match.listAdminTeams",
  LIST_ADMIN_FIXTURES: "match.listAdminFixtures",
  GET_ADMIN_MATCH: "match.getAdminMatch",
});

export type MatchQueryType = (typeof MATCH_QUERY)[keyof typeof MATCH_QUERY];

export const MATCH_COMMAND = Object.freeze({
  CREATE_LEAGUE: "match.createLeague",
  CREATE_TEAM: "match.createTeam",
  UPDATE_TEAM: "match.updateTeam",
  CREATE_FIXTURE: "match.createFixture",
  PERFORM_MATCH_ACTION: "match.performMatchAction",
});

export type MatchCommandType =
  (typeof MATCH_COMMAND)[keyof typeof MATCH_COMMAND];

export const LIFECYCLE_STATUS: Readonly<Record<MatchLifecycle, MatchStatus>> =
  Object.freeze({
    FIXTURE_CREATED: "SCHEDULED",
    MARKETS_CREATED: "SCHEDULED",
    ODDS_PUBLISHED: "SCHEDULED",
    BETTING_OPEN: "BETTING_OPEN",
    BETTING_ACTIVE: "BETTING_OPEN",
    BETTING_CLOSED: "BETTING_CLOSED",
    SIMULATION_STARTED: "BETTING_CLOSED",
    RESULT_GENERATED: "IN_PLAY",
    EVENTS_PUBLISHED: "IN_PLAY",
    MATCH_FINISHED: "COMPLETED",
    SETTLEMENT_STARTED: "COMPLETED",
    SETTLEMENT_COMPLETED: "COMPLETED",
    SIMULATION_FAILED: "BETTING_CLOSED",
    SETTLEMENT_FAILED: "COMPLETED",
    VOIDED: "CANCELLED",
  });

export const SCHEDULER = Object.freeze({
  LOCK_KEY: "lock:match:scheduler",
  LOCK_TTL_MS: 5000,
  TICK_MS: 1000,
  /** Most matches one step handles per tick, so a backlog cannot starve the later steps. */
  BATCH_SIZE: 200,
  REVEAL_BATCH_SIZE: 100,
  /** How long a worker owns a match while a peer call is in flight; a crashed worker's claim lapses after it. */
  LEASE_MS: 15_000,
  /** Gap kept between creating a round and closing its betting, so markets are published in time. */
  ROUND_MARGIN_SECONDS: 20,
  BACKOFF_BASE_MS: 2000,
  BACKOFF_MAX_MS: 60_000,
  MAX_SIMULATION_ATTEMPTS: 5,
  SYSTEM_ACTOR: "system",
});

export const LIST_LIMIT = Object.freeze({
  DEFAULT: 100,
  MAX: 500,
  RESULTS_DEFAULT: 50,
  SCORERS_DEFAULT: 20,
  SCORERS_MAX: 100,
  EVENTS_MAX: 500,
  WINDOW_MS: 30 * 60 * 1000,
});
