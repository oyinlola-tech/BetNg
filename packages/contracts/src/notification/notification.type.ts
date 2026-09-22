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
  "BET_ACCEPTED",
  "PAYMENT_UPDATED",
  "KYC_UPDATED",
  "SECURITY_ALERT",
  "LIMIT_WARNING",
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
  /** The BetNG payment reference a PAYMENT_UPDATED notification is about. */
  readonly paymentReference?: string | undefined;
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
  paymentReference: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/).optional(),
  createdAt: isoTimestampSchema,
});

export const markNotificationsReadRequestSchema = z.object({
  ids: z.array(z.uuid()).max(200).optional(),
});

export type MarkNotificationsReadRequest = z.infer<
  typeof markNotificationsReadRequestSchema
>;
