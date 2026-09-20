/**
 * Match statistics, owned by the match service.
 *
 * Produced by the simulation alongside the timeline and served over
 * `GET /matches/:id/stats`. While a match is in play the figures are those
 * as of the most recent event, so a client can show them live.
 */

import { z } from "@zudojs/validation";
import { brandedIdSchema, type MatchId } from "../common/index.js";

export interface SideStats {
  readonly possession: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly corners: number;
  readonly fouls: number;
  readonly offsides: number;
  readonly yellowCards: number;
  readonly redCards: number;
}

export const sideStatsSchema = z.object({
  possession: z.number().min(0).max(100),
  shots: z.int().min(0),
  shotsOnTarget: z.int().min(0),
  corners: z.int().min(0),
  fouls: z.int().min(0),
  offsides: z.int().min(0),
  yellowCards: z.int().min(0),
  redCards: z.int().min(0),
});

export interface MatchStats {
  readonly matchId: MatchId;
  readonly asOfMinute: number;
  readonly home: SideStats;
  readonly away: SideStats;
}

export const matchStatsSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  asOfMinute: z.int().min(0).max(120),
  home: sideStatsSchema,
  away: sideStatsSchema,
});
