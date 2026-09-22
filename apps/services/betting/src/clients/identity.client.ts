import type { Logger } from "@betng/service-kit";
import { createRPCMetadata } from "@zudojs/rpc";
import type { RPCClient } from "@zudojs/rpc";
import { classifyPeerFailure, PeerUnavailableError } from "../errors/index.js";
import type {
  AuditEntry,
  IdentityPeer,
  LimitDecision,
  LimitRefusal,
} from "../interfaces/index.js";

export const IDENTITY_PROCEDURE = Object.freeze({
  VERIFY_CASHIER_PIN: "identity.verifyCashierPin",
  RECORD_AUDIT: "identity.recordAudit",
  CHECK_LIMITS: "limits.check",
});

const REFUSALS: readonly LimitRefusal[] = ["SELF_EXCLUDED", "LIMIT_EXCEEDED", "ACCOUNT_RESTRICTED"];

function toLimitDecision(answer: unknown): LimitDecision | undefined {
  if (typeof answer !== "object" || answer === null) return undefined;

  const { allowed, code } = answer as { allowed?: unknown; code?: unknown };

  if (allowed === true) return { allowed: true };

  return allowed === false && REFUSALS.includes(code as LimitRefusal)
    ? { allowed: false, code: code as LimitRefusal }
    : undefined;
}

interface VerifyCashierPinInput {
  readonly cashierId: string;
  readonly pin: string;
}

export function createIdentityPeer(
  client: RPCClient,
  logger: Logger,
): IdentityPeer {
  return {
    checkLimits: async (input, requestId) => {
      let answer: unknown;

      try {
        answer = await client.call<typeof input, unknown>(
          IDENTITY_PROCEDURE.CHECK_LIMITS,
          input,
          { metadata: createRPCMetadata({ requestId }) },
        );
      } catch (error) {
        throw new PeerUnavailableError("identity", error);
      }

      const decision = toLimitDecision(answer);

      if (decision === undefined) {
        throw new PeerUnavailableError(
          "identity",
          new Error("The limits answer was not one the contract defines."),
        );
      }

      return decision;
    },

    verifyCashierPin: async (cashierId, pin, requestId) => {
      let answer: unknown;

      try {
        answer = await client.call<VerifyCashierPinInput, unknown>(
          IDENTITY_PROCEDURE.VERIFY_CASHIER_PIN,
          { cashierId, pin },
          { metadata: createRPCMetadata({ requestId }) },
        );
      } catch (error) {
        throw classifyPeerFailure("identity", error);
      }

      const valid =
        typeof answer === "object" && answer !== null
          ? (answer as { valid?: unknown }).valid
          : undefined;

      if (typeof valid !== "boolean") {
        throw new PeerUnavailableError(
          "identity",
          new Error("The answer did not say whether the PIN is valid."),
        );
      }

      return valid;
    },

    recordAudit: async (entry) => {
      try {
        await client.call<AuditEntry, unknown>(
          IDENTITY_PROCEDURE.RECORD_AUDIT,
          entry,
          { metadata: createRPCMetadata({ requestId: entry.requestId }) },
        );
      } catch (error) {
        logger.warn("Audit entry was not recorded", {
          requestId: entry.requestId,
          event: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}
