import type { Logger } from "@betng/service-kit";
import { createRPCMetadata } from "@zudojs/rpc";
import type { RPCClient } from "@zudojs/rpc";
import { classifyPeerFailure, PeerUnavailableError } from "../errors/index.js";
import type { AuditEntry, IdentityPeer } from "../interfaces/index.js";

export const IDENTITY_PROCEDURE = Object.freeze({
  VERIFY_CASHIER_PIN: "identity.verifyCashierPin",
  RECORD_AUDIT: "identity.recordAudit",
});

interface VerifyCashierPinInput {
  readonly cashierId: string;
  readonly pin: string;
}

export function createIdentityPeer(
  client: RPCClient,
  logger: Logger,
): IdentityPeer {
  return {
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
