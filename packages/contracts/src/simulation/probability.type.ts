/**
 * Outcome-probability contracts.
 *
 * The simulation service owns probability; the odds service turns it into a
 * price. Splitting them means a change to pricing margin cannot quietly
 * become a change to how likely an outcome is.
 */

import { z } from "@zudojs/validation";
import { brandedIdSchema } from "../common/index.js";
import { simulationTeamSchema } from "./simulation.type.js";

/** The body of `POST /api/v1/probabilities`. */
export const probabilityRequestSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  homeTeam: simulationTeamSchema,
  awayTeam: simulationTeamSchema,
});

export type ProbabilityRequest = z.infer<typeof probabilityRequestSchema>;

/**
 * The response of `POST /api/v1/probabilities`.
 *
 * The three outcome probabilities sum to 1.
 */
export const outcomeProbabilitiesSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  homeWin: z.number().min(0).max(1),
  draw: z.number().min(0).max(1),
  awayWin: z.number().min(0).max(1),
});

export type OutcomeProbabilities = z.infer<typeof outcomeProbabilitiesSchema>;
