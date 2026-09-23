import type { MessageStatus, SuppressionReason } from "../generated/prisma/client.js";

export interface MessageRecord {
  readonly id: string;
  readonly toAddress: string;
  readonly template: string;
  readonly subject: string;
  readonly status: MessageStatus;
  readonly providerId: string | null;
  readonly providerStatus: string | null;
  readonly failureReason: string | null;
  readonly idempotencyKey: string;
  readonly attempts: number;
  readonly lastEventAt: Date | null;
  readonly createdAt: Date;
}

export interface CreateMessageInput {
  readonly toAddress: string;
  readonly toHash: string;
  readonly template: string;
  readonly subject: string;
  readonly variables: Readonly<Record<string, string>>;
  readonly tags: readonly string[];
  readonly idempotencyKey: string;
}

/** `duplicate` is true when the key already belonged to a message; the stored row is returned as it is. */
export interface CreateMessageResult {
  readonly message: MessageRecord;
  readonly duplicate: boolean;
}

export type EventState = "NEW" | "PENDING" | "DONE";

export interface RecordEventInput {
  readonly provider: string;
  readonly eventId: string;
  readonly eventType: string;
  readonly messageId: string | undefined;
  readonly occurredAt: Date | undefined;
}

export interface EmailRepository {
  createMessage(input: CreateMessageInput): Promise<CreateMessageResult>;
  findById(id: string): Promise<MessageRecord | undefined>;
  findByIdempotencyKey(key: string): Promise<MessageRecord | undefined>;
  findByProviderId(providerId: string): Promise<MessageRecord | undefined>;
  markSent(id: string, providerId: string | undefined, providerStatus: string | undefined): Promise<MessageRecord>;
  markFailed(id: string, reason: string): Promise<MessageRecord>;
  applyDeliveryStatus(id: string, status: MessageStatus, occurredAt: Date | undefined): Promise<void>;

  /** `INSERT … ON CONFLICT DO NOTHING`, so a webhook replayed mid-flight answers PENDING, not NEW. */
  recordEvent(input: RecordEventInput): Promise<EventState>;
  completeEvent(provider: string, eventId: string, outcome: string): Promise<void>;

  isSuppressed(addressHash: string): Promise<boolean>;
  suppress(addressHash: string, address: string, reason: SuppressionReason, source: string): Promise<void>;
}
