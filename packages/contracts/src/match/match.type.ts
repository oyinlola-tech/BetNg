import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  isoTimestampSchema,
  type FixtureId,
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
  readonly score?: MatchScore;
  readonly completedAt?: string;
  /** The canonical lifecycle state; see `matchLifecycleSchema`. */
  readonly lifecycle?: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const matchSchema = z.object({
  id: brandedIdSchema<"MatchId">(),
  fixtureId: brandedIdSchema<"FixtureId">(),
  status: matchStatusSchema,
  score: matchScoreSchema.optional(),
  completedAt: isoTimestampSchema.optional(),
  lifecycle: z.string().max(32).optional(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const listMatchesQuerySchema = z.object({
  leagueId: brandedIdSchema<"LeagueId">().optional(),
  status: matchStatusSchema.optional(),
  season: z.coerce.number().int().min(1).optional(),
  matchday: z.coerce.number().int().min(1).optional(),
  from: isoTimestampSchema.optional(),
  to: isoTimestampSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;

export const listTeamsQuerySchema = z.object({
  leagueId: brandedIdSchema<"LeagueId">().optional(),
});

export type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>;
