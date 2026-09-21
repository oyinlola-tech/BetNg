import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  isoTimestampSchema,
  type MarketId,
  type MatchId,
} from "../common/index.js";
import { selectionSchema, type Selection } from "./selection.type.js";

export const marketTypeSchema = z.enum([
  "MATCH_RESULT",
  "DOUBLE_CHANCE",
  "OVER_UNDER",
  "BOTH_TEAMS_TO_SCORE",
  "CORRECT_SCORE",
  "GOAL_SPREAD",
]);

export type MarketType = z.infer<typeof marketTypeSchema>;

export const marketStatusSchema = z.enum([
  "OPEN",
  "SUSPENDED",
  "CLOSED",
  "SETTLED",
  "VOID",
]);

export type MarketStatus = z.infer<typeof marketStatusSchema>;

export interface Market {
  readonly id: MarketId;
  readonly matchId: MatchId;
  readonly type: MarketType;
  readonly status: MarketStatus;
  /** The line for a totals or spread market: 2.5, -1.5. */
  readonly line?: number | undefined;
  /** Increments whenever the market's prices or status change. The same for every reader. */
  readonly oddsVersion?: number | undefined;
  readonly selections: readonly Selection[];
  readonly updatedAt: string;
}

export const marketSchema = z.object({
  id: brandedIdSchema<"MarketId">(),
  matchId: brandedIdSchema<"MatchId">(),
  type: marketTypeSchema,
  status: marketStatusSchema,
  line: z.number().optional(),
  oddsVersion: z.int().min(1).optional(),
  selections: z.array(selectionSchema).min(2),
  updatedAt: isoTimestampSchema,
});

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

/** The immutable record of a market's prices at one version. Bets reference the version they were accepted at. */
export const oddsSnapshotSchema = z.object({
  id: z.uuid(),
  marketId: brandedIdSchema<"MarketId">(),
  matchId: brandedIdSchema<"MatchId">(),
  oddsVersion: z.int().min(1),
  reason: z.enum(["INITIAL", "ADMIN_REPRICE", "STATUS_CHANGE"]),
  prices: z.array(
    z.object({
      selectionId: brandedIdSchema<"SelectionId">(),
      code: z.string().max(32),
      odds: z.number().gt(1),
      probability: z.number().min(0).max(1),
    }),
  ),
  createdAt: isoTimestampSchema,
});

export type OddsSnapshot = z.infer<typeof oddsSnapshotSchema>;
