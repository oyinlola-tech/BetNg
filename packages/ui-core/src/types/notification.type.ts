import type { BetId, MatchId } from "@betng/contracts";

export type NotificationKind =
  | "MATCH_STARTING"
  | "MATCH_FINISHED"
  | "RESULT_AVAILABLE"
  | "BET_SETTLED"
  | "MATCH_EVENT"
  | "BET_ACCEPTED"
  | "PAYMENT_UPDATED"
  | "KYC_UPDATED"
  | "SECURITY_ALERT"
  | "LIMIT_WARNING";

export interface NotificationView {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  readonly createdAt: string;
  readonly read: boolean;
  readonly matchId?: MatchId;
  readonly betId?: BetId;
  readonly paymentReference?: string;
}

export interface NotificationPreferences {
  readonly matchStarting: boolean;
  readonly matchFinished: boolean;
  readonly betSettled: boolean;
  readonly goals: boolean;
}
