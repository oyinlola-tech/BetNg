/**
 * Simulation contracts, implemented by the Python simulation service.
 *
 * The simulation engine is the sole source of a match result. It runs only
 * after betting has closed, and its inputs are team properties and the
 * fixture — never the book's position or any bettor's exposure. Keeping bet
 * data out of the request shape is what makes that guarantee checkable
 * rather than merely stated.
 *
 * These types describe the wire format. The Python service implements them
 * from `docs/api.md`; it does not import this package.
 */

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
  /**
   * Optional seed for a reproducible run. Supplying one makes a simulation
   * repeatable for testing; omitting it draws fresh randomness.
   */
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
