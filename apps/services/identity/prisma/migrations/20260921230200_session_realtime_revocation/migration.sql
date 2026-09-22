-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "realtime_revoked_at" TIMESTAMPTZ(3);

-- A revoked session stays pending until both the gateway cache and the event service have dropped it.
DROP INDEX "sessions_eviction_pending";
CREATE INDEX "sessions_eviction_pending" ON "sessions" ("revoked_at")
  WHERE "revoked_at" IS NOT NULL AND ("cache_evicted_at" IS NULL OR "realtime_revoked_at" IS NULL);
