import {
  liveEventTypeSchema,
  matchClockSchema,
  matchScoreSchema,
  matchSideSchema,
} from "@betng/contracts";
import { z } from "@zudojs/validation";

/**
 * The body of the `event.publishEvent` procedure.
 *
 * `sequence` is absent on purpose: the event service assigns it, so two
 * publishers cannot hand out the same number and a client's gap detection
 * stays meaningful.
 */
export const publishEventPayloadSchema = z.object({
  matchId: z.uuid(),
  type: liveEventTypeSchema,
  minute: z.int().min(0).max(120),
  side: matchSideSchema.optional(),
  score: matchScoreSchema,
  description: z.string().max(240),
  clock: matchClockSchema.optional(),
});

export type PublishEventPayload = z.infer<typeof publishEventPayloadSchema>;
