import type { NotificationKind } from "@betng/contracts";

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

export interface SmsMessage {
  /** International format without `+`, e.g. 2348035550142. */
  readonly to: string;
  readonly text: string;
}

export interface PushMessage {
  readonly token: string;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, string>>;
}

export type PushOutcome = "delivered" | "unregistered";

/** One attempt each, bounded by a timeout: none of these providers takes an idempotency key, so a retry could send twice. */
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<void>;
}

export interface PushProvider {
  readonly name: string;
  send(message: PushMessage): Promise<PushOutcome>;
}

export interface DeliveryProviders {
  readonly email: EmailProvider;
  readonly sms: SmsProvider | undefined;
  readonly push: PushProvider | undefined;
}

export type SecurityAlert =
  | { readonly kind: "NEW_LOGIN"; readonly device: string | undefined; readonly browser: string | undefined; readonly platform: string | undefined }
  | { readonly kind: "PASSWORD_CHANGED" }
  | { readonly kind: "PASSWORD_RESET" }
  | { readonly kind: "TWO_FACTOR_ENABLED" }
  | { readonly kind: "TWO_FACTOR_DISABLED" }
  | { readonly kind: "BACKUP_CODES_REGENERATED" }
  | { readonly kind: "ACCOUNT_DELETION_REQUESTED"; readonly scheduledFor: Date };

export interface CustomerNotice {
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, unknown>> | undefined;
}

export interface Messenger {
  /** Sends a one-time code by email. Throws when the provider did not accept it. */
  sendCode(to: string, purpose: "verification" | "password_reset", code: string, expiresAt: Date): Promise<void>;
  /** Best effort and never throws: the change it reports has already happened. */
  securityAlert(customerId: string, alert: SecurityAlert): Promise<void>;
  /** Best effort and never throws: delivers an in-app notification over the channels the customer switched on. */
  fanOut(customerId: string, notice: CustomerNotice): Promise<void>;
  /** Stores an in-app notification (once per `dedupeKey`) and fans the first copy out. Best effort; never throws. */
  notice(customerId: string, notice: CustomerNotice & { readonly dedupeKey?: string | undefined }): Promise<void>;
}
