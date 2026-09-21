import type { Logger } from "@betng/service-kit";
import { AuditUnavailableError } from "../errors/index.js";
import type { AuditRecorder, IdentityPeer } from "../interfaces/index.js";

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createAuditRecorder(identity: IdentityPeer, logger: Logger): AuditRecorder {
  return {
    recordBestEffort: async (entry) => {
      try {
        await identity.recordAudit(entry);
      } catch (error) {
        logger.warn("Audit entry could not be written", {
          requestId: entry.requestId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          error: describe(error),
        });
      }
    },

    recordRequired: async (entry) => {
      try {
        await identity.recordAudit(entry);
      } catch (error) {
        logger.error("Required audit entry could not be written", {
          requestId: entry.requestId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          error: describe(error),
        });

        throw new AuditUnavailableError(error);
      }
    },
  };
}
