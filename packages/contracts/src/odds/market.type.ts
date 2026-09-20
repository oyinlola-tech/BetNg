/**
 * Market contracts.
 *
 * Markets and prices are produced by the Python odds service from the
 * probabilities the simulation service exposes. The contracts live here so
 * the TypeScript and Python services agree on one wire format; the Python
 * service implements them from `docs/api.md` rather than importing this
 * package.
 */

import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  isoTimestampSchema,
  type MarketId,
  type MatchId,
} from "../common/index.js";
import { selectionSchema, type Selection } from "./selection.type.js";

/** The market types the foundation recognises. */
export const marketTypeSchema = z.enum([
  "MATCH_RESULT",
  "DOUBLE_CHANCE",
  "OVER_UNDER",
  "BOTH_TEAMS_TO_SCORE",
  "CORRECT_SCORE",
  "GOAL_SPREAD",
]);

export type MarketType = z.infer<typeof marketTypeSchema>;

export const marketStatusSchema = z.enum(["OPEN", "SUSPENDED", "SETTLED"]);

export type MarketStatus = z.infer<typeof marketStatusSchema>;

export interface Market {
  readonly id: MarketId;
  readonly matchId: MatchId;
  readonly type: MarketType;
  readonly status: MarketStatus;
  /** The line for a totals or spread market: 2.5, -1.5. */
  readonly line?: number | undefined;
  readonly selections: readonly Selection[];
  readonly updatedAt: string;
}

export const marketSchema = z.object({
  id: brandedIdSchema<"MarketId">(),
  matchId: brandedIdSchema<"MatchId">(),
  type: marketTypeSchema,
  status: marketStatusSchema,
  line: z.number().optional(),
  selections: z.array(selectionSchema).min(2),
  updatedAt: isoTimestampSchema,
});

/** Every market currently priced for one match. */
export interface MatchOdds {
  readonly matchId: MatchId;
  readonly markets: readonly Market[];
  readonly generatedAt: string;
}

export const matchOddsSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  markets: z.array(marketSchema),
  generatedAt: isoTimestampSchema,
});
