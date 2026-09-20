/**
 * Match lifecycle contracts, owned by the match service.
 */

import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  isoTimestampSchema,
  type FixtureId,
  type LeagueId,
  type MatchId,
} from "../common/index.js";

/**
 * The states a match moves through, in order.
 *
 * The ordering encodes the platform's central integrity rule: betting closes
 * before the simulation runs, so no accepted bet can influence the result.
 * See `docs/architecture.md`.
 */
export const matchStatusSchema = z.enum([
  "SCHEDULED",
  "BETTING_OPEN",
  "BETTING_CLOSED",
  "IN_PLAY",
  "COMPLETED",
  "CANCELLED",
]);

export type MatchStatus = z.infer<typeof matchStatusSchema>;

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

export const listMatchesQuerySchema = z.object({
  leagueId: brandedIdSchema<"LeagueId">().optional(),
  status: matchStatusSchema.optional(),
});

export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;

export const listTeamsQuerySchema = z.object({
  leagueId: brandedIdSchema<"LeagueId">().optional(),
});

export type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>;
