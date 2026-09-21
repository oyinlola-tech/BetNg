import { z } from "@zudojs/validation";
import { brandedIdSchema, isoTimestampSchema } from "../common/index.js";

export const matchLifecycleSchema = z.enum([
  "FIXTURE_CREATED",
  "MARKETS_CREATED",
  "ODDS_PUBLISHED",
  "BETTING_OPEN",
  "BETTING_ACTIVE",
  "BETTING_CLOSED",
  "SIMULATION_STARTED",
  "RESULT_GENERATED",
  "EVENTS_PUBLISHED",
  "MATCH_FINISHED",
  "SETTLEMENT_STARTED",
  "SETTLEMENT_COMPLETED",
  "SIMULATION_FAILED",
  "SETTLEMENT_FAILED",
  "VOIDED",
]);

export type MatchLifecycle = z.infer<typeof matchLifecycleSchema>;

const rating = z.number().min(0).max(100);

/** What the simulation knows about a team. A property of the team, never of a bettor. */
export const teamStrengthSchema = z.object({
  attack: rating,
  defence: rating,
  midfield: rating,
  goalkeeping: rating,
  pace: rating,
  finishing: rating,
  possession: rating,
  form: z.number().min(-10).max(10),
  homeAdvantage: rating,
});

export type TeamStrength = z.infer<typeof teamStrengthSchema>;

export const matchWinnerSchema = z.enum(["HOME", "AWAY", "DRAW"]);

export type MatchWinner = z.infer<typeof matchWinnerSchema>;

/** The one authoritative result of a match. Immutable once committed. */
export const matchResultSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  homeGoals: z.int().min(0),
  awayGoals: z.int().min(0),
  winner: matchWinnerSchema,
  /** `abs(homeGoals - awayGoals)`. Derived from the result, never an input. */
  winningGap: z.int().min(0),
  seed: z.string().min(8).max(128),
  modelVersion: z.string().max(40),
  configurationVersion: z.int().min(1),
  simulationId: z.uuid(),
  createdAt: isoTimestampSchema,
});

export type MatchResult = z.infer<typeof matchResultSchema>;

/** One row of `GET /results`. */
export const completedMatchSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  fixtureId: brandedIdSchema<"FixtureId">(),
  leagueId: brandedIdSchema<"LeagueId">(),
  season: z.int().min(1),
  matchday: z.int().min(1),
  homeTeamId: brandedIdSchema<"TeamId">(),
  awayTeamId: brandedIdSchema<"TeamId">(),
  kickoffAt: isoTimestampSchema,
  completedAt: isoTimestampSchema,
  result: matchResultSchema.pick({ homeGoals: true, awayGoals: true, winner: true, winningGap: true }),
});

export type CompletedMatch = z.infer<typeof completedMatchSchema>;

export const probabilityMatrixSchema = z.object({
  homeXg: z.number().min(0),
  awayXg: z.number().min(0),
  maxGoals: z.int().min(1),
  /** `scoreMatrix[h][a]` is P(home scores h, away scores a); the cells sum to 1. */
  scoreMatrix: z.array(z.array(z.number().min(0).max(1))),
  modelVersion: z.string().max(40),
  configurationVersion: z.int().min(1),
});

export type ProbabilityMatrix = z.infer<typeof probabilityMatrixSchema>;

export const simulationTeamInputSchema = z.object({
  teamId: brandedIdSchema<"TeamId">(),
  name: z.string().min(1).max(120),
  shortName: z.string().min(2).max(8),
  strength: teamStrengthSchema,
});

/** `simulation.runMatch`. Carries no bet, bettor, shop or exposure field, by design. */
export const runMatchRequestSchema = z
  .object({
    matchId: brandedIdSchema<"MatchId">(),
    home: simulationTeamInputSchema,
    away: simulationTeamInputSchema,
  })
  .strict();

export type RunMatchRequest = z.infer<typeof runMatchRequestSchema>;

export const runMatchResponseSchema = z.object({
  simulationId: z.uuid(),
  matchId: brandedIdSchema<"MatchId">(),
  status: z.enum(["COMPLETED", "FAILED"]),
  /** True when the match had already been simulated and the stored run was returned. */
  duplicate: z.boolean(),
  modelVersion: z.string().max(40),
  configurationVersion: z.int().min(1),
  seed: z.string(),
  result: matchResultSchema.pick({ homeGoals: true, awayGoals: true, winner: true, winningGap: true }),
  eventCount: z.int().min(0),
});

export type RunMatchResponse = z.infer<typeof runMatchResponseSchema>;
