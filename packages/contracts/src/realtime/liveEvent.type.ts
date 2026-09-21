import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  isoTimestampSchema,
  type MatchId,
} from "../common/index.js";
import {
  matchClockSchema,
  matchScoreSchema,
  matchSideSchema,
  type MatchClock,
} from "../match/index.js";

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
  "BETTING_OPENED",
  "BETTING_CLOSED",
  "ODDS_UPDATED",
  "SIMULATION_STARTED",
  "SETTLEMENT_STARTED",
  "SETTLEMENT_COMPLETED",
]);

export type LiveEventType = z.infer<typeof liveEventTypeSchema>;

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
  readonly clock?: MatchClock | undefined;
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
  clock: matchClockSchema.optional(),
});

export { MATCH_CHANNEL_PATTERN, matchChannel } from "../runtime.js";
