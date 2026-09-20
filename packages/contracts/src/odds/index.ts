/**
 * Odds and market contracts.
 *
 * Markets and prices are produced by the Python odds service from the
 * probabilities the simulation service exposes. The contracts live here so
 * the TypeScript services and the Python service agree on one wire format;
 * the Python service implements these shapes from `docs/api.md` rather than
 * importing this package.
 */

import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  decimalOddsSchema,
  isoTimestampSchema,
  type MarketId,
  type MatchId,
  type SelectionId,
} from "../common/primitives.js";

/** The market types the foundation recognises. */
export const marketTypeSchema = z.enum([
  /** Home win / draw / away win. */
  "MATCH_RESULT",
  /** Total goals over or under a line. */
  "OVER_UNDER",
  /** Whether both teams score. */
  "BOTH_TEAMS_TO_SCORE",
]);
export type MarketType = z.infer<typeof marketTypeSchema>;

/** One priced outcome within a market. */
export interface Selection {
  readonly id: SelectionId;
  readonly marketId: MarketId;
  /** Stable machine code, e.g. `HOME`, `OVER_2_5`, `YES`. */
  readonly code: string;
  readonly label: string;
  readonly odds: number;
  /**
   * The simulation's probability for this outcome, 0–1.
   *
   * Carried alongside the price so the risk service can reason about the
   * margin without recomputing it.
   */
  readonly probability: number;
}

export const selectionSchema = z.object({
  id: brandedIdSchema<"SelectionId">(),
  marketId: brandedIdSchema<"MarketId">(),
  code: z.string().min(1).max(32),
  label: z.string().min(1).max(64),
  odds: decimalOddsSchema,
  probability: z.number().min(0).max(1),
});

export const marketStatusSchema = z.enum(["OPEN", "SUSPENDED", "SETTLED"]);
export type MarketStatus = z.infer<typeof marketStatusSchema>;

export interface Market {
  readonly id: MarketId;
  readonly matchId: MatchId;
  readonly type: MarketType;
  readonly status: MarketStatus;
  readonly selections: readonly Selection[];
  readonly updatedAt: string;
}

export const marketSchema = z.object({
  id: brandedIdSchema<"MarketId">(),
  matchId: brandedIdSchema<"MatchId">(),
  type: marketTypeSchema,
  status: marketStatusSchema,
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
