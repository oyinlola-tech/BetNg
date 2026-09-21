import type { Logger } from "@betng/service-kit";
import { MAINTENANCE } from "../constants/index.js";
import type { IdentityStore } from "../interfaces/index.js";

export interface MaintenanceJob {
  readonly stop: () => void;
}

export function startMaintenanceJob(store: IdentityStore, logger: Logger): MaintenanceJob {
  const sweep = async (): Promise<void> => {
    const now = Date.now();

    try {
      const [sessions, verifications, resets, throttles, notifications] = await Promise.all([
        store.sessions.purgeExpiredBefore(new Date(now - MAINTENANCE.SESSION_RETENTION_MS)),
        store.verifications.purgeOlderThan(new Date(now - MAINTENANCE.VERIFICATION_RETENTION_MS)),
        store.passwordResets.purgeOlderThan(new Date(now - MAINTENANCE.VERIFICATION_RETENTION_MS)),
        store.throttles.purgeOlderThan(new Date(now - MAINTENANCE.THROTTLE_RETENTION_MS)),
        store.notifications.purgeOlderThan(new Date(now - MAINTENANCE.NOTIFICATION_RETENTION_MS)),
      ]);

      logger.debug("Maintenance sweep finished", {
        sessions,
        verifications,
        resets,
        throttles,
        notifications,
      });
    } catch (error) {
      logger.error("Maintenance sweep failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const timer = setInterval(() => void sweep(), MAINTENANCE.INTERVAL_MS);

  timer.unref();

  return { stop: () => clearInterval(timer) };
}
