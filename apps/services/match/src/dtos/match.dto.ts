/**
 * Request and response shapes that are this service's own.
 *
 * Everything a client can depend on comes from `@betng/contracts`. What is declared here is either a request the
 * contracts do not name (the admin catalogue writes, the list filters) or a documented superset of a contract
 * shape, which stays wire-compatible with it.
 */

import {
  brandedIdSchema,
  isoTimestampSchema,
  leagueStatusSchema,
  matchStatusSchema,
  teamColorsSchema,
  teamRatingsSchema,
} from "@betng/contracts";
import type { AdminFixture, MatchLifecycle, Team } from "@betng/contracts";
import { z } from "@zudojs/validation";

export type TeamDto = Team & { readonly code: string };

export interface AdminMatchDto extends AdminFixture {
  readonly fixtureId: string;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly lifecycle: MatchLifecycle;
  readonly bettingClosesAt: string;
  readonly failureCount: number;
  readonly failureReason?: string;
  readonly nextAttemptAt?: string;
  readonly transitions: readonly {
    readonly from: string | null;
    readonly to: string;
    readonly at: string;
    readonly actor: string;
    readonly reason?: string;
  }[];
}

export interface ItemsDto<T> {
  readonly items: readonly T[];
}

const season = z.coerce.number().int().min(1).max(100_000);
const matchday = z.coerce.number().int().min(1).max(1000);

export const listFixturesQuerySchema = z.object({
  leagueId: brandedIdSchema<"LeagueId">().optional(),
  season: season.optional(),
  matchday: matchday.optional(),
  from: isoTimestampSchema.optional(),
  to: isoTimestampSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export type ListFixturesQuery = z.infer<typeof listFixturesQuerySchema>;

export const listResultsQuerySchema = z.object({
  leagueId: brandedIdSchema<"LeagueId">().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export type ListResultsQuery = z.infer<typeof listResultsQuerySchema>;

export const seasonQuerySchema = z.object({
  season: season.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type SeasonQuery = z.infer<typeof seasonQuerySchema>;

export const adminFixturesQuerySchema = listFixturesQuerySchema.extend({
  matchStatus: matchStatusSchema.optional(),
});

export type AdminFixturesQuery = z.infer<typeof adminFixturesQuerySchema>;

export const createLeagueRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    code: z.string().trim().regex(/^[A-Z0-9]{2,8}$/),
    slug: z.string().regex(/^[a-z0-9-]+$/).min(2).max(40),
    country: z.string().trim().min(2).max(60),
    sport: z.string().trim().min(1).max(32).optional(),
    status: leagueStatusSchema.optional(),
  })
  .strict();

export type CreateLeagueRequest = z.infer<typeof createLeagueRequestSchema>;

export const createTeamRequestSchema = z
  .object({
    leagueId: brandedIdSchema<"LeagueId">(),
    name: z.string().trim().min(1).max(120),
    shortName: z.string().trim().min(2).max(12),
    code: z.string().regex(/^[A-Z0-9]{2,4}$/),
    city: z.string().trim().max(60).optional(),
    stadium: z.string().trim().max(80).optional(),
    colors: teamColorsSchema.optional(),
    ratings: teamRatingsSchema,
    possession: z.int().min(1).max(99).optional(),
    homeAdvantage: z.int().min(0).max(100).optional(),
  })
  .strict();

export type CreateTeamRequest = z.infer<typeof createTeamRequestSchema>;

export const createFixtureRequestSchema = z
  .object({
    leagueId: brandedIdSchema<"LeagueId">(),
    homeTeamId: brandedIdSchema<"TeamId">(),
    awayTeamId: brandedIdSchema<"TeamId">(),
    kickoffAt: isoTimestampSchema,
    season: z.int().min(1).max(100_000).optional(),
    matchday: z.int().min(1).max(1000).optional(),
  })
  .strict();

export type CreateFixtureRequest = z.infer<typeof createFixtureRequestSchema>;

export const uuidParamSchema = z.uuid();
