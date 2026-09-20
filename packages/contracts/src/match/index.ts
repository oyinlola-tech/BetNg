/**
 * Match domain contracts — owned by the match service.
 *
 * Covers the competition structure (league, team, fixture) and the lifecycle
 * of a single virtual match, including the events the simulation service
 * produces once a match has been played.
 */

import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  decimalOddsSchema,
  isoTimestampSchema,
  type FixtureId,
  type LeagueId,
  type MatchEventId,
  type MatchId,
  type TeamId,
} from "../common/primitives.js";

/* -------------------------------------------------------------------------- */
/* League and team                                                            */
/* -------------------------------------------------------------------------- */

export interface League {
  readonly id: LeagueId;
  readonly name: string;
  /** Short display code, e.g. `NPL`. */
  readonly code: string;
  readonly country: string;
  readonly createdAt: string;
}

export const leagueSchema = z.object({
  id: brandedIdSchema<"LeagueId">(),
  name: z.string().min(1).max(120),
  code: z.string().min(2).max(8),
  country: z.string().min(2).max(60),
  createdAt: isoTimestampSchema,
});

export interface Team {
  readonly id: TeamId;
  readonly leagueId: LeagueId;
  readonly name: string;
  readonly shortName: string;
  /**
   * The team's simulated strength, 0–100.
   *
   * Consumed by the simulation service as one input to match probability.
   * It is a property of the team, never of an individual bettor's position.
   */
  readonly strength: number;
  readonly createdAt: string;
}

export const teamSchema = z.object({
  id: brandedIdSchema<"TeamId">(),
  leagueId: brandedIdSchema<"LeagueId">(),
  name: z.string().min(1).max(120),
  shortName: z.string().min(2).max(8),
  strength: z.number().min(0).max(100),
  createdAt: isoTimestampSchema,
});

/* -------------------------------------------------------------------------- */
/* Fixture and match lifecycle                                                */
/* -------------------------------------------------------------------------- */

/**
 * The states a match moves through, in order.
 *
 * The ordering encodes the platform's central integrity rule: betting closes
 * (`BETTING_CLOSED`) before the simulation runs (`IN_PLAY`), so no accepted
 * bet can influence the result. See `docs/architecture.md`.
 */
export const matchStatusSchema = z.enum([
  /** Created, not yet open for bets. */
  "SCHEDULED",
  /** Accepting bets. */
  "BETTING_OPEN",
  /** No further bets accepted; awaiting simulation. */
  "BETTING_CLOSED",
  /** The simulation is producing the timeline. */
  "IN_PLAY",
  /** The simulation finished; a result exists. */
  "COMPLETED",
  /** Abandoned before a result was produced; stakes are voided. */
  "CANCELLED",
]);
export type MatchStatus = z.infer<typeof matchStatusSchema>;

export interface Fixture {
  readonly id: FixtureId;
  readonly leagueId: LeagueId;
  /** 1-based matchday within the league's season. */
  readonly matchday: number;
  readonly homeTeamId: TeamId;
  readonly awayTeamId: TeamId;
  /** When the match is scheduled to kick off. */
  readonly kickoffAt: string;
  /** After this instant the betting service rejects new bets. */
  readonly bettingClosesAt: string;
  readonly createdAt: string;
}

export const fixtureSchema = z.object({
  id: brandedIdSchema<"FixtureId">(),
  leagueId: brandedIdSchema<"LeagueId">(),
  matchday: z.int().min(1),
  homeTeamId: brandedIdSchema<"TeamId">(),
  awayTeamId: brandedIdSchema<"TeamId">(),
  kickoffAt: isoTimestampSchema,
  bettingClosesAt: isoTimestampSchema,
  createdAt: isoTimestampSchema,
});

/** The final score of a completed match. */
export interface MatchScore {
  readonly home: number;
  readonly away: number;
}

export const matchScoreSchema = z.object({
  home: z.int().min(0),
  away: z.int().min(0),
});

export interface Match {
  readonly id: MatchId;
  readonly fixtureId: FixtureId;
  readonly status: MatchStatus;
  /** Present only once `status` is `COMPLETED`. */
  readonly score?: MatchScore;
  /** When the simulation produced the result. */
  readonly completedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const matchSchema = z.object({
  id: brandedIdSchema<"MatchId">(),
  fixtureId: brandedIdSchema<"FixtureId">(),
  status: matchStatusSchema,
  score: matchScoreSchema.optional(),
  completedAt: isoTimestampSchema.optional(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

/* -------------------------------------------------------------------------- */
/* Match events                                                               */
/* -------------------------------------------------------------------------- */

export const matchEventTypeSchema = z.enum([
  "KICK_OFF",
  "GOAL",
  "YELLOW_CARD",
  "RED_CARD",
  "SUBSTITUTION",
  "HALF_TIME",
  "FULL_TIME",
]);
export type MatchEventType = z.infer<typeof matchEventTypeSchema>;

export const matchSideSchema = z.enum(["HOME", "AWAY"]);
export type MatchSide = z.infer<typeof matchSideSchema>;

/** One entry on a played match's timeline. */
export interface MatchEvent {
  readonly id: MatchEventId;
  readonly matchId: MatchId;
  readonly type: MatchEventType;
  /** Match minute, 0–120. */
  readonly minute: number;
  /** Absent for events that belong to neither side, e.g. `HALF_TIME`. */
  readonly side?: MatchSide;
  readonly description: string;
}

export const matchEventSchema = z.object({
  id: brandedIdSchema<"MatchEventId">(),
  matchId: brandedIdSchema<"MatchId">(),
  type: matchEventTypeSchema,
  minute: z.int().min(0).max(120),
  side: matchSideSchema.optional(),
  description: z.string().max(240),
});

/* -------------------------------------------------------------------------- */
/* Request payloads                                                           */
/* -------------------------------------------------------------------------- */

export const listMatchesQuerySchema = z.object({
  leagueId: brandedIdSchema<"LeagueId">().optional(),
  status: matchStatusSchema.optional(),
});
export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;

/** Re-exported so odds contracts can describe a match's price list. */
export { decimalOddsSchema };
