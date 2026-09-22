import type { Logger } from "@betng/service-kit";
import { kycStatusSchema, kycTierSchema } from "@betng/contracts";
import type { KycStatus, KycTier } from "@betng/contracts";
import { createRPCMetadata, RPCError } from "@zudojs/rpc";
import type { RPCClient } from "@zudojs/rpc";
import { IDENTITY_PROCEDURE } from "../constants/payments.constant.js";

export type LimitAction = "DEPOSIT" | "WITHDRAWAL";

export type LimitDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly code: "SELF_EXCLUDED" | "LIMIT_EXCEEDED" | "ACCOUNT_RESTRICTED";
      readonly message: string;
    };

export interface KycAnswer {
  readonly status: KycStatus;
  readonly tier: KycTier;
  readonly dailyDeposit: number | undefined;
  readonly dailyWithdrawal: number | undefined;
}

export interface PaymentNotification {
  readonly customerId: string;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, string | number>>;
  readonly dedupeKey: string;
}

export interface AuditRecord {
  readonly actorId: string;
  readonly actorRole: string;
  readonly actorName: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly reason: string;
  readonly severity: "INFO" | "NOTICE" | "WARNING" | "CRITICAL";
}

/** Identity did not answer, or answered something that is not the agreed shape. Money actions fail closed on it. */
export class IdentityUnavailableError extends Error {
  public constructor(procedure: string) {
    super(`identity did not give a usable answer to ${procedure}.`);
    this.name = "IdentityUnavailableError";
  }
}

export interface IdentityPeer {
  checkLimit(userId: string, action: LimitAction, amount: number, requestId: string): Promise<LimitDecision>;
  kycStatus(userId: string, requestId: string): Promise<KycAnswer>;
  verifyCashierPin(cashierId: string, pin: string, requestId: string): Promise<boolean>;
  recordAudit(entry: AuditRecord, requestId: string): Promise<void>;
  /** Best effort: a notification that cannot be delivered is logged, never allowed to undo a settled payment. */
  notify(notification: PaymentNotification, requestId: string): Promise<void>;
}

const REFUSAL_CODES = new Set(["SELF_EXCLUDED", "LIMIT_EXCEEDED", "ACCOUNT_RESTRICTED"]);

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

function optionalKobo(value: unknown, procedure: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new IdentityUnavailableError(procedure);
  }

  return value;
}

export function createIdentityPeer(client: RPCClient, logger: Logger): IdentityPeer {
  async function call(procedure: string, payload: unknown, requestId: string): Promise<unknown> {
    try {
      return await client.call<unknown, unknown>(procedure, payload, {
        metadata: createRPCMetadata({ requestId }),
      });
    } catch (error) {
      logger.warn("Identity call failed", {
        requestId,
        event: procedure,
        error: error instanceof RPCError ? error.code : error instanceof Error ? error.name : "unknown",
      });

      throw new IdentityUnavailableError(procedure);
    }
  }

  return {
    checkLimit: async (userId, action, amount, requestId) => {
      const answer = await call(IDENTITY_PROCEDURE.LIMITS_CHECK, { userId, action, amount }, requestId);
      const allowed = field(answer, "allowed");

      if (allowed === true) {
        return { allowed: true };
      }

      const code = field(answer, "code");
      const message = field(answer, "message");

      if (allowed !== false || typeof code !== "string" || !REFUSAL_CODES.has(code)) {
        throw new IdentityUnavailableError(IDENTITY_PROCEDURE.LIMITS_CHECK);
      }

      return {
        allowed: false,
        code: code as "SELF_EXCLUDED" | "LIMIT_EXCEEDED" | "ACCOUNT_RESTRICTED",
        message: typeof message === "string" && message.length <= 200 ? message : "This payment is not allowed on your account.",
      };
    },

    kycStatus: async (userId, requestId) => {
      const answer = await call(IDENTITY_PROCEDURE.KYC_STATUS, { userId }, requestId);
      const status = kycStatusSchema.safeParse(field(answer, "status"));
      const tier = kycTierSchema.safeParse(field(answer, "tier"));

      if (!status.success || !tier.success) {
        throw new IdentityUnavailableError(IDENTITY_PROCEDURE.KYC_STATUS);
      }

      return {
        status: status.data,
        tier: tier.data,
        dailyDeposit: optionalKobo(field(answer, "dailyDeposit"), IDENTITY_PROCEDURE.KYC_STATUS),
        dailyWithdrawal: optionalKobo(field(answer, "dailyWithdrawal"), IDENTITY_PROCEDURE.KYC_STATUS),
      };
    },

    verifyCashierPin: async (cashierId, pin, requestId) => {
      const valid = field(await call(IDENTITY_PROCEDURE.VERIFY_CASHIER_PIN, { cashierId, pin }, requestId), "valid");

      if (typeof valid !== "boolean") {
        throw new IdentityUnavailableError(IDENTITY_PROCEDURE.VERIFY_CASHIER_PIN);
      }

      return valid;
    },

    recordAudit: async (entry, requestId) => {
      const id = field(await call(IDENTITY_PROCEDURE.RECORD_AUDIT, { ...entry, reason: entry.reason.slice(0, 240), requestId }, requestId), "id");

      if (typeof id !== "string") {
        throw new IdentityUnavailableError(IDENTITY_PROCEDURE.RECORD_AUDIT);
      }
    },

    notify: async (notification, requestId) => {
      try {
        await call(
          IDENTITY_PROCEDURE.NOTIFY,
          {
            customerId: notification.customerId,
            kind: "PAYMENT_UPDATED",
            title: notification.title,
            body: notification.body,
            data: notification.data,
            dedupeKey: notification.dedupeKey,
          },
          requestId,
        );
      } catch {
        logger.warn("Payment notification was not delivered", { requestId, event: "payment_notification" });
      }
    },
  };
}
