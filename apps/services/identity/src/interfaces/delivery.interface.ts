import type { NotificationKind } from "@betng/contracts";

/**
 * Email is composed by the email service from a template it owns; identity passes the name and the
 * values. A value listed as secret by that template — a code, a temporary password — is rendered and
 * dropped, never stored.
 */
export interface EmailMessage {
  readonly to: string;
  readonly template: string;
  readonly variables: Readonly<Record<string, string>>;
  /** Makes a retry, here or inside the email service, collapse onto one message. */
  readonly idempotencyKey: string;
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

/** One attempt each, bounded by a timeout. Only email takes an idempotency key; an SMS retry could send twice. */
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
  /** Browser PushSubscriptions (platform "web"); FCM never sees them. */
  readonly webPush?: PushProvider | undefined;
}

export type SecurityAlert =
  | { readonly kind: "NEW_LOGIN"; readonly device: string | undefined; readonly browser: string | undefined; readonly platform: string | undefined }
  | { readonly kind: "PASSWORD_CHANGED" }
  | { readonly kind: "PASSWORD_RESET" }
  | { readonly kind: "PROFILE_UPDATED"; readonly bySupport: boolean }
  | { readonly kind: "PASSWORD_RESET_SENT_BY_SUPPORT" }
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
  /**
   * Sends one template to an address that is not a customer — an operator being given credentials, an
   * applicant being told a decision. Throws when the provider did not accept it.
   */
  sendTemplate(message: EmailMessage): Promise<void>;
  /** Best effort and never throws: the change it reports has already happened. */
  securityAlert(customerId: string, alert: SecurityAlert): Promise<void>;
  /** Best effort and never throws: delivers an in-app notification over the channels the customer switched on. */
  fanOut(customerId: string, notice: CustomerNotice): Promise<void>;
  /** Stores an in-app notification (once per `dedupeKey`) and fans the first copy out. Best effort; never throws. */
  notice(customerId: string, notice: CustomerNotice & { readonly dedupeKey?: string | undefined }): Promise<void>;
}
