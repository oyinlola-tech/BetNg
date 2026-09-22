import type { Logger, RedisConnection } from "@betng/service-kit";
import type { IdentityStore } from "../../interfaces/index.js";

const BATCH = 200;

export interface SessionCacheEvictor {
  /** Drops every revoked session from the gateway cache and the event service. Never throws; what failed is retried by the next flush. */
  flush(): Promise<void>;
}

/** Tells the event service to close private subscriptions opened with a session (`event.revokeSessions`). */
export interface RealtimeRevoker {
  revoke(tokenHash: string): Promise<void>;
}

export const gatewayActorKey = (tokenHash: string): string => `gateway:actor:${tokenHash}`;

/**
 * The gateway caches `identity.authenticate` answers under `gateway:actor:<sha256 hex of the token>`, which is exactly
 * `sessions.token_hash`. Each side is marked done only after it confirmed, so a Redis or event-service outage is retried
 * (the maintenance timer flushes every few seconds) instead of forgotten. The Redis delete is idempotent.
 */
export function createSessionCacheEvictor(
  store: IdentityStore,
  redis: RedisConnection | undefined,
  realtime: RealtimeRevoker | undefined,
  logger: Logger,
): SessionCacheEvictor {
  let running: Promise<void> | undefined;

  const failed = (target: string, error: unknown): void => {
    logger.error("Revoked sessions could not be dropped; will retry", {
      event: "session_revocation_propagation_failed",
      target,
      error: error instanceof Error ? error.message : String(error),
    });
  };

  const evictCache = async (pending: readonly { id: string; tokenHash: string }[], now: Date): Promise<void> => {
    if (pending.length === 0) {
      return;
    }

    try {
      if (redis !== undefined) {
        await redis.connect();
        await redis.client.del(pending.map((session) => gatewayActorKey(session.tokenHash)));
      }

      await store.sessions.markEvicted(pending.map((session) => session.id), now);
    } catch (error) {
      failed("gateway_cache", error);
    }
  };

  const revokeRealtime = async (pending: readonly { id: string; tokenHash: string }[], now: Date): Promise<void> => {
    if (pending.length === 0) {
      return;
    }

    if (realtime === undefined) {
      await store.sessions.markRealtimeRevoked(pending.map((session) => session.id), now);

      return;
    }

    const done: string[] = [];

    // The first failure ends the pass: the event service is unreachable, and the next flush retries from the same row.
    try {
      for (const session of pending) {
        await realtime.revoke(session.tokenHash);
        done.push(session.id);
      }
    } catch (error) {
      failed("event_service", error);
    }

    await store.sessions.markRealtimeRevoked(done, now);
  };

  const run = async (): Promise<void> => {
    const now = new Date();

    await evictCache(await store.sessions.pendingEviction(now, BATCH, "cache"), now);
    await revokeRealtime(await store.sessions.pendingEviction(now, BATCH, "realtime"), now);
  };

  return {
    flush: async () => {
      running ??= run()
        .catch((error: unknown) => failed("database", error))
        .finally(() => {
          running = undefined;
        });

      await running;
    },
  };
}
