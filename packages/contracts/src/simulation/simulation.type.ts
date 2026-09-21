import { z } from "@zudojs/validation";
import { brandedIdSchema, isoTimestampSchema } from "../common/index.js";
import {
  matchEventTypeSchema,
  matchScoreSchema,
  matchSideSchema,
} from "../match/index.js";

export const simulationTeamSchema = z.object({
  id: brandedIdSchema<"TeamId">(),
  name: z.string().min(1).max(120),
  strength: z.number().min(0).max(100),
});

export type SimulationTeam = z.infer<typeof simulationTeamSchema>;

/**
 * The body of `POST /api/v1/simulations`.
 *
 * Note what is absent: no stakes, no liabilities, no bet identifiers. The
 * request carries no information about who bet on what.
 */
export const simulationRequestSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  homeTeam: simulationTeamSchema,
  awayTeam: simulationTeamSchema,
  seed: z.int().optional(),
});

export type SimulationRequest = z.infer<typeof simulationRequestSchema>;

export const simulatedEventSchema = z.object({
  type: matchEventTypeSchema,
  minute: z.int().min(0).max(120),
  side: matchSideSchema.optional(),
  description: z.string().max(240),
});

export type SimulatedEvent = z.infer<typeof simulatedEventSchema>;

export const simulationResultSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  score: matchScoreSchema,
  events: z.array(simulatedEventSchema),
  seed: z.int(),
  completedAt: isoTimestampSchema,
});

export type SimulationResult = z.infer<typeof simulationResultSchema>;
