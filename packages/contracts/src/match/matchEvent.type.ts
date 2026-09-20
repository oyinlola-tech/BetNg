import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  type MatchEventId,
  type MatchId,
} from "../common/index.js";
import { matchScoreSchema, type MatchScore } from "./match.type.js";

export const matchEventTypeSchema = z.enum([
  "KICK_OFF",
  "GOAL",
  "YELLOW_CARD",
  "RED_CARD",
  "SUBSTITUTION",
  "CORNER",
  "HALF_TIME",
  "SECOND_HALF",
  "FULL_TIME",
]);

export type MatchEventType = z.infer<typeof matchEventTypeSchema>;

export const matchSideSchema = z.enum(["HOME", "AWAY"]);

export type MatchSide = z.infer<typeof matchSideSchema>;

export interface MatchEvent {
  readonly id: MatchEventId;
  readonly matchId: MatchId;
  readonly type: MatchEventType;
  readonly minute: number;
  readonly side?: MatchSide;
  /** The player the event is about: scorer, booked player, player coming on. */
  readonly player?: string | undefined;
  /** The assist for a goal, or the player going off for a substitution. */
  readonly secondaryPlayer?: string | undefined;
  /** The running score after this event, so a timeline reads without adding up. */
  readonly score?: MatchScore | undefined;
  readonly description: string;
}

export const matchEventSchema = z.object({
  id: brandedIdSchema<"MatchEventId">(),
  matchId: brandedIdSchema<"MatchId">(),
  type: matchEventTypeSchema,
  minute: z.int().min(0).max(120),
  side: matchSideSchema.optional(),
  player: z.string().max(80).optional(),
  secondaryPlayer: z.string().max(80).optional(),
  score: matchScoreSchema.optional(),
  description: z.string().max(240),
});
