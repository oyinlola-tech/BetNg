import type { AuditWriter } from "../../interfaces/index.js";
import { redactSnapshot } from "../../utils/index.js";

export function createAuditWriter(): AuditWriter {
  return {
    write: async (repositories, entry) => {
      const stored = await repositories.audit.append({
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        actorName: entry.actorName,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: redactSnapshot(entry.before),
        after: redactSnapshot(entry.after),
        reason: entry.reason,
        severity: entry.severity ?? "INFO",
        requestId: entry.requestId,
      });

      return stored.id;
    },
  };
}
