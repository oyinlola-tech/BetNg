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

const privateOrSystemChannel = z
  .string()
  .max(128)
  .regex(/^(?:system|admin|risk|(?:wallet|bets|notifications|user|shop):[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/);

export const publishSignalPayloadSchema = z.object({
  channel: privateOrSystemChannel,
  type: z.enum([
    "BET_UPDATED",
    "BET_ACCEPTED",
    "BET_SETTLED",
    "WALLET_UPDATED",
    "NOTIFICATION_CREATED",
    "SYSTEM_STATUS_UPDATED",
    "RISK_ALERT",
  ]),
  payload: z.strictObject({ betId: z.uuid().optional() }).optional(),
});

export type PublishSignalPayload = z.infer<typeof publishSignalPayloadSchema>;

export const revokeSessionsPayloadSchema = z
  .object({
    tokenHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
    userId: z.uuid().optional(),
  })
  .refine((value) => value.tokenHash !== undefined || value.userId !== undefined, {
    message: "Name a tokenHash or a userId.",
  });

export type RevokeSessionsPayload = z.infer<typeof revokeSessionsPayloadSchema>;
