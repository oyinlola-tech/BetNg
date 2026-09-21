/**
 * Read contracts the clients are built against that no service serves yet:
 * the match clock, lineups, head to head, search, public configuration and
 * paged transactions. Proposed shapes, listed in docs/api-integration.md
 * for the owning service to confirm.
 */

import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  isoTimestampSchema,
  minorUnitsSchema,
} from "../common/index.js";
import { matchScoreSchema, matchSideSchema } from "../match/index.js";

export const clockPeriodSchema = z.enum([
  "PRE",
  "FIRST_HALF",
  "HALF_TIME",
  "SECOND_HALF",
  "FULL_TIME",
]);

/** `GET /matches/:id` and the live stream carry this so no client derives a minute from kick-off time. */
export const matchClockSchema = z.object({
  period: clockPeriodSchema,
  minute: z.int().min(0).max(130),
  addedMinutes: z.int().min(0).max(30).optional(),
  asOf: isoTimestampSchema,
  minuteLengthMs: z.int().min(1).optional(),
});

export type MatchClock = z.infer<typeof matchClockSchema>;

export const lineupPlayerSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  shirt: z.int().min(1).max(99).optional(),
  position: z.enum(["GK", "DF", "MF", "FW"]).optional(),
  captain: z.boolean().optional(),
  grid: z.object({ row: z.int().min(1), slot: z.int().min(1) }).optional(),
  substitutedMinute: z.int().min(0).optional(),
});

export const teamLineupSchema = z.object({
  teamId: brandedIdSchema<"TeamId">(),
  side: matchSideSchema,
  formation: z.string().max(12).optional(),
  manager: z.string().max(120).optional(),
  starting: z.array(lineupPlayerSchema).max(11),
  substitutes: z.array(lineupPlayerSchema).max(15),
});

/** `GET /matches/:id/lineups` */
export const matchLineupsSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  confirmed: z.boolean(),
  home: teamLineupSchema.optional(),
  away: teamLineupSchema.optional(),
});

export type MatchLineups = z.infer<typeof matchLineupsSchema>;

export const headToHeadMeetingSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  leagueId: brandedIdSchema<"LeagueId">(),
  homeTeamId: brandedIdSchema<"TeamId">(),
  awayTeamId: brandedIdSchema<"TeamId">(),
  kickoffAt: isoTimestampSchema,
  score: matchScoreSchema,
});

/** `GET /matches/:id/head-to-head` */
export const headToHeadSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  played: z.int().min(0),
  homeWins: z.int().min(0),
  draws: z.int().min(0),
  awayWins: z.int().min(0),
  meetings: z.array(headToHeadMeetingSchema).max(20),
});

export type HeadToHead = z.infer<typeof headToHeadSchema>;

export const searchKindSchema = z.enum([
  "TEAM",
  "MATCH",
  "LEAGUE",
  "PLAYER",
  "MARKET",
]);

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
  kinds: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const searchHitSchema = z.object({
  kind: searchKindSchema,
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(160),
  subtitle: z.string().max(160).optional(),
  matchId: z.string().max(64).optional(),
  leagueId: z.string().max(64).optional(),
  teamId: z.string().max(64).optional(),
});

/** `GET /search?q=` */
export const searchResponseSchema = z.object({
  term: z.string(),
  hits: z.array(searchHitSchema).max(50),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;

/** `GET /config`: what an anonymous client may know. */
export const publicConfigSchema = z.object({
  currency: z.object({
    code: z.string().length(3),
    symbol: z.string().min(1).max(4),
    minorUnits: z.int().min(0).max(4),
    locale: z.string().min(2).max(20),
  }),
  features: z.record(z.string(), z.boolean()),
  stakeLimits: z
    .object({
      min: minorUnitsSchema.min(1),
      max: minorUnitsSchema.min(1),
      maxSelections: z.int().min(1).max(50),
    })
    .optional(),
  competitionTimezone: z.string().max(64).optional(),
  maintenance: z.boolean().optional(),
});

export type PublicConfig = z.infer<typeof publicConfigSchema>;

export const transactionStatusSchema = z.enum([
  "PENDING",
  "COMPLETED",
  "FAILED",
  "REVERSED",
]);

/** `GET /wallets/:userId/transactions` with paging; `types` and `statuses` are comma separated. */
export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  types: z.string().max(120).optional(),
  statuses: z.string().max(80).optional(),
  from: isoTimestampSchema.optional(),
  to: isoTimestampSchema.optional(),
  search: z.string().trim().max(80).optional(),
  sort: z.enum(["createdAt", "amount"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
});

export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
