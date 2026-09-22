import { randomToken } from "@zudojs/crypto";
import { ACCOUNT_SECURITY, AUDIT_ACTION, AUDIT_ENTITY, MAINTENANCE, SYSTEM_ACTOR } from "../constants/index.js";
import type { HandlerDependencies } from "../interfaces/index.js";
import { deletionBlockers } from "../services/accountSecurity/index.js";

type Dependencies = Pick<HandlerDependencies, "store" | "readModel" | "hasher" | "audit" | "evictor" | "logger">;

export interface ComplianceJob {
  readonly stop: () => void;
}

/**
 * Completes deletions whose cooling-off has ended and whose blockers have cleared: personal data is replaced, sessions are
 * revoked and the change is audited in one transaction. Wallet, bet, settlement, KYC and audit rows keep the customer id;
 * the ledger is append-only and is never touched.
 */
export async function completeDueDeletions(deps: Dependencies, now = new Date()): Promise<number> {
  const { store, readModel, hasher, audit, evictor, logger } = deps;
  let completed = 0;

  for (const deletion of await store.deletions.due(now, ACCOUNT_SECURITY.DELETION_BATCH)) {
    const blockers = await deletionBlockers(readModel, deletion.customerId);

    if (blockers.length > 0) {
      logger.info("Account deletion is waiting for its blockers to clear", {
        event: "account_deletion_blocked",
        deletionId: deletion.id,
        blockers: blockers.length,
      });
      continue;
    }

    const passwordHash = await hasher.hash(await randomToken(32));

    const done = await store.transaction(async (repositories) => {
      if (!(await repositories.deletions.complete(deletion.id, now))) {
        return false;
      }

      await repositories.deletions.anonymise(
        deletion.customerId,
        { email: `deleted-${deletion.customerId}@deleted.invalid`, displayName: "Deleted customer", passwordHash },
        now,
      );
      await repositories.sessions.revokeOthers(deletion.customerId, undefined, now);
      await audit.write(repositories, {
        actorId: SYSTEM_ACTOR.id,
        actorRole: SYSTEM_ACTOR.role,
        actorName: SYSTEM_ACTOR.name,
        action: AUDIT_ACTION.CUSTOMER_DELETED,
        entityType: AUDIT_ENTITY.CUSTOMER,
        entityId: deletion.customerId,
        after: { deletionId: deletion.id, requestedAt: deletion.requestedAt },
        severity: "NOTICE",
        requestId: `deletion:${deletion.id}`.slice(0, 64),
      });

      return true;
    });

    if (done) {
      completed += 1;
    }
  }

  if (completed > 0) {
    await evictor.flush();
  }

  return completed;
}

export function startComplianceJob(deps: Dependencies): ComplianceJob {
  const { store, evictor, logger } = deps;

  const sweep = async (): Promise<void> => {
    const now = new Date();

    try {
      const [limits, deleted, codes, uploads] = await Promise.all([
        store.limits.settleDue(undefined, now),
        completeDueDeletions(deps, now),
        store.twoFactor.purgeOlderThan(new Date(now.getTime() - MAINTENANCE.CHALLENGE_RETENTION_MS)),
        store.kyc.purgeUploadsOlderThan(new Date(now.getTime() - MAINTENANCE.UPLOAD_RETENTION_MS)),
      ]);

      logger.debug("Compliance sweep finished", { limits, deleted, codes, uploads });
    } catch (error) {
      logger.error("Compliance sweep failed", { error: error instanceof Error ? error.message : String(error) });
    }
  };

  const compliance = setInterval(() => void sweep(), MAINTENANCE.COMPLIANCE_INTERVAL_MS);
  const eviction = setInterval(() => void evictor.flush(), MAINTENANCE.EVICTION_INTERVAL_MS);

  compliance.unref();
  eviction.unref();

  return {
    stop: () => {
      clearInterval(compliance);
      clearInterval(eviction);
    },
  };
}
