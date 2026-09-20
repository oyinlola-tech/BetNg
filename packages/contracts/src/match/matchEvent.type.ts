/**
 * Match timeline contracts.
 *
 * Events are produced by the simulation service once a match has been
 * played and stored by the match service.
 */

import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  type MatchEventId,
  type MatchId,
} from "../common/index.js";

export const matchEventTypeSchema = z.enum([
  "KICK_OFF",
  "GOAL",
  "YELLOW_CARD",
  "RED_CARD",
  "SUBSTITUTION",
  "HALF_TIME",
  "FULL_TIME",
]);

export type MatchEventType = z.infer<typeof matchEventTypeSchema>;

export const matchSideSchema = z.enum(["HOME", "AWAY"]);

export type MatchSide = z.infer<typeof matchSideSchema>;

/** One entry on a played match's timeline. */
export interface MatchEvent {
  readonly id: MatchEventId;
  readonly matchId: MatchId;
  readonly type: MatchEventType;
  /** Match minute, 0 to 120. */
  readonly minute: number;
  /** Absent for an event belonging to neither side, such as `HALF_TIME`. */
  readonly side?: MatchSide;
  readonly description: string;
}

export const matchEventSchema = z.object({
  id: brandedIdSchema<"MatchEventId">(),
  matchId: brandedIdSchema<"MatchId">(),
  type: matchEventTypeSchema,
  minute: z.int().min(0).max(120),
  side: matchSideSchema.optional(),
  description: z.string().max(240),
});
