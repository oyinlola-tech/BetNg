export interface OutboundEmail {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly replyTo: string | undefined;
  readonly tags: readonly string[];
  readonly idempotencyKey: string;
}

export interface SendResult {
  /** The provider's own id (`em_…`), stored so a webhook can be tied back to the message. */
  readonly providerId: string | undefined;
  readonly providerStatus: string | undefined;
}

export type WebhookOutcome = "DELIVERED" | "BOUNCED" | "COMPLAINED" | "SENT" | "IGNORED";

export interface DeliveryEvent {
  /** Unique per provider; the idempotency key for a replayed delivery. */
  readonly eventId: string;
  readonly eventType: string;
  readonly providerId: string | undefined;
  readonly outcome: WebhookOutcome;
  readonly occurredAt: Date | undefined;
  /** Present on a bounce or a complaint, so the address can be suppressed. */
  readonly address: string | undefined;
  readonly permanent: boolean;
}

export type HeaderReader = (name: string) => string | undefined;

export interface EmailProvider {
  readonly id: string;
  /** False for an adapter that exists but cannot reach its provider. */
  readonly configured: boolean;
  send(message: OutboundEmail): Promise<SendResult>;
  /** Verifies the signature over the raw bytes before anything is parsed; throws otherwise. */
  parseWebhook(rawBody: Uint8Array, header: HeaderReader): DeliveryEvent;
  probe(): Promise<void>;
}
