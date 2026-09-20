/**
 * Notification contracts.
 *
 * In-app notifications a client lists and marks read, served over
 * `GET /users/:id/notifications`. A push provider, when one is added,
 * delivers the same records over a different transport; the shape does
 * not change.
 */

import { z } from "@zudojs/validation";
import {
  brandedIdSchema,
  isoTimestampSchema,
  type BetId,
  type MatchId,
  type UserId,
} from "../common/index.js";

export const notificationKindSchema = z.enum([
  "MATCH_STARTING",
  "MATCH_FINISHED",
  "RESULT_AVAILABLE",
  "BET_SETTLED",
  "MATCH_EVENT",
]);

export type NotificationKind = z.infer<typeof notificationKindSchema>;

export interface Notification {
  readonly id: string;
  readonly userId: UserId;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  readonly read: boolean;
  readonly matchId?: MatchId | undefined;
  readonly betId?: BetId | undefined;
  readonly createdAt: string;
}

export const notificationSchema = z.object({
  id: z.uuid(),
  userId: brandedIdSchema<"UserId">(),
  kind: notificationKindSchema,
  title: z.string().min(1).max(120),
  body: z.string().max(240),
  read: z.boolean(),
  matchId: brandedIdSchema<"MatchId">().optional(),
  betId: brandedIdSchema<"BetId">().optional(),
  createdAt: isoTimestampSchema,
});

export const markNotificationsReadRequestSchema = z.object({
  ids: z.array(z.uuid()).max(200).optional(),
});

export type MarkNotificationsReadRequest = z.infer<typeof markNotificationsReadRequestSchema>;
