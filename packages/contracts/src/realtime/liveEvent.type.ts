/**
 * Live match event contracts.
 *
 * These describe what the event service pushes to subscribed clients over
 * WebSocket while a virtual match is being played.
 *
 * The stream is **not** the source of truth. It is a projection of what the
 * simulation already decided: a client that misses a frame re-reads the match
 * from the match service and is correct again. That is why every frame
 * carries a `sequence` and the match's running `score` — a consumer can tell
 * that it missed something, and can resynchronise without replaying.
 */

import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  isoTimestampSchema,
  type MatchId,
} from "../common/index.js";
import { matchScoreSchema, matchSideSchema } from "../match/index.js";

export const liveEventTypeSchema = z.enum([
  "MATCH_STARTED",
  "KICKOFF",
  "GOAL",
  "YELLOW_CARD",
  "RED_CARD",
  "CORNER",
  "SUBSTITUTION",
  "HALF_TIME",
  "SECOND_HALF",
  "MATCH_FINISHED",
]);

export type LiveEventType = z.infer<typeof liveEventTypeSchema>;

/**
 * One frame on a match's live stream.
 *
 * `sequence` is per match and strictly increasing, so a client can detect a
 * gap. `score` is the running score *after* this event, so a late joiner is
 * correct from its first frame rather than having to add up goals.
 */
export interface LiveEvent {
  readonly matchId: MatchId;
  readonly sequence: number;
  readonly type: LiveEventType;
  readonly minute: number;
  /**
   * Absent for an event belonging to neither side, such as `HALF_TIME`.
   *
   * Explicitly `| undefined` rather than only optional: the schema below
   * infers that, and under `exactOptionalPropertyTypes` a validated event
   * would otherwise not be assignable to this type.
   */
  readonly side?: "HOME" | "AWAY" | undefined;
  readonly score: { readonly home: number; readonly away: number };
  readonly description: string;
  readonly occurredAt: string;
}

export const liveEventSchema = z.object({
  matchId: brandedIdSchema<"MatchId">(),
  sequence: z.int().min(1),
  type: liveEventTypeSchema,
  minute: z.int().min(0).max(120),
  side: matchSideSchema.optional(),
  score: matchScoreSchema,
  description: z.string().max(240),
  occurredAt: isoTimestampSchema,
});

export { MATCH_CHANNEL_PATTERN, matchChannel } from "../runtime.js";
