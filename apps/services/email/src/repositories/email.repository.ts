import { isConflictError } from "@zudojs/database";
import type { MessageStatus, PrismaClient, SuppressionReason } from "../generated/prisma/client.js";
import type {
  CreateMessageInput,
  CreateMessageResult,
  EmailRepository,
  EventState,
  MessageRecord,
  RecordEventInput,
} from "../interfaces/index.js";

const SELECT = Object.freeze({
  id: true,
  toAddress: true,
  template: true,
  subject: true,
  status: true,
  providerId: true,
  providerStatus: true,
  failureReason: true,
  idempotencyKey: true,
  attempts: true,
  lastEventAt: true,
  createdAt: true,
});

/** A provider only ever tells us something more final than what we already recorded. */
const RANK: Readonly<Record<MessageStatus, number>> = {
  QUEUED: 0,
  SENT: 1,
  DELIVERED: 2,
  BOUNCED: 2,
  COMPLAINED: 2,
  FAILED: 2,
};

export function createEmailRepository(prisma: PrismaClient): EmailRepository {
  const byKey = async (idempotencyKey: string): Promise<MessageRecord | undefined> =>
    (await prisma.emailMessage.findUnique({ where: { idempotencyKey }, select: SELECT })) ?? undefined;

  return {
    createMessage: async (input: CreateMessageInput): Promise<CreateMessageResult> => {
      try {
        const message = await prisma.emailMessage.create({
          data: {
            toAddress: input.toAddress,
            toHash: input.toHash,
            template: input.template,
            subject: input.subject,
            variables: input.variables,
            tags: [...input.tags],
            idempotencyKey: input.idempotencyKey,
          },
          select: SELECT,
        });

        return { message, duplicate: false };
      } catch (error) {
        if (!isConflictError(error)) {
          throw error;
        }

        // Two callers raced on one key. The first row is the answer for both.
        const existing = await byKey(input.idempotencyKey);

        if (existing === undefined) {
          throw error;
        }

        return { message: existing, duplicate: true };
      }
    },

    findById: async (id) => (await prisma.emailMessage.findUnique({ where: { id }, select: SELECT })) ?? undefined,

    findByIdempotencyKey: byKey,

    findByProviderId: async (providerId) =>
      (await prisma.emailMessage.findFirst({ where: { providerId }, select: SELECT })) ?? undefined,

    markSent: async (id, providerId, providerStatus) =>
      prisma.emailMessage.update({
        where: { id },
        data: {
          status: "SENT",
          ...(providerId === undefined ? {} : { providerId }),
          ...(providerStatus === undefined ? {} : { providerStatus }),
          attempts: { increment: 1 },
        },
        select: SELECT,
      }),

    markFailed: async (id, reason) =>
      prisma.emailMessage.update({
        where: { id },
        data: { status: "FAILED", failureReason: reason.slice(0, 200), attempts: { increment: 1 } },
        select: SELECT,
      }),

    applyDeliveryStatus: async (id, status, occurredAt) => {
      const current = await prisma.emailMessage.findUnique({ where: { id }, select: { status: true } });

      // The trigger would refuse a backward move anyway; refusing here keeps the error out of the log.
      if (current === null || RANK[status] <= RANK[current.status]) {
        return;
      }

      await prisma.emailMessage.update({
        where: { id },
        data: { status, lastEventAt: occurredAt ?? new Date() },
      });
    },

    recordEvent: async (input: RecordEventInput): Promise<EventState> => {
      try {
        await prisma.emailEvent.create({
          data: {
            provider: input.provider,
            eventId: input.eventId,
            eventType: input.eventType,
            ...(input.messageId === undefined ? {} : { messageId: input.messageId }),
            ...(input.occurredAt === undefined ? {} : { occurredAt: input.occurredAt }),
          },
        });

        return "NEW";
      } catch (error) {
        if (!isConflictError(error)) {
          throw error;
        }

        const existing = await prisma.emailEvent.findUnique({
          where: { provider_eventId: { provider: input.provider, eventId: input.eventId } },
          select: { processedAt: true },
        });

        return existing?.processedAt === null || existing === null ? "PENDING" : "DONE";
      }
    },

    completeEvent: async (provider, eventId, outcome) => {
      await prisma.emailEvent.update({
        where: { provider_eventId: { provider, eventId } },
        data: { outcome: outcome.slice(0, 40), processedAt: new Date() },
      });
    },

    isSuppressed: async (hash) =>
      (await prisma.emailSuppression.findUnique({ where: { addressHash: hash }, select: { addressHash: true } })) !== null,

    suppress: async (hash, address, reason: SuppressionReason, source) => {
      await prisma.emailSuppression.upsert({
        where: { addressHash: hash },
        create: { addressHash: hash, address, reason, source: source.slice(0, 60) },
        update: {},
      });
    },
  };
}
