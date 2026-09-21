import type {
  CommandActor,
  HandlerDependencies,
} from "./match.dependencies.js";

/** Best effort: a catalogue addition stands even when identity is unreachable, and the miss is logged. */
export async function recordCatalogueAudit(
  deps: Pick<HandlerDependencies, "identity" | "logger">,
  actor: CommandActor,
  action: string,
  entityType: string,
  entityId: string,
  after: unknown,
): Promise<void> {
  try {
    await deps.identity.recordAudit({
      actorId: actor.id,
      actorRole: actor.role,
      action,
      entityType,
      entityId,
      after,
      severity: "INFO",
      requestId: actor.requestId,
    });
  } catch (error) {
    deps.logger.warn("Audit entry not written", {
      event: "match.auditFailed",
      action,
      entityId,
      requestId: actor.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
