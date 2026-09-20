import { z } from "@zudojs/validation";
import { brandedIdSchema } from "../common/index.js";
import { simulationTeamSchema } from "./simulation.type.js";

export const probabilityRequestSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  homeTeam: simulationTeamSchema,
  awayTeam: simulationTeamSchema,
});

export type ProbabilityRequest = z.infer<typeof probabilityRequestSchema>;

export const outcomeProbabilitiesSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  homeWin: z.number().min(0).max(1),
  draw: z.number().min(0).max(1),
  awayWin: z.number().min(0).max(1),
});

export type OutcomeProbabilities = z.infer<typeof outcomeProbabilitiesSchema>;
