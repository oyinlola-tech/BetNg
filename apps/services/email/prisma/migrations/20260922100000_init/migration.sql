-- The `email` schema is created by infrastructure/postgres/bootstrap.sql; this login may not create schemas.

-- CreateEnum
CREATE TYPE "message_status" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED');

-- CreateEnum
CREATE TYPE "suppression_reason" AS ENUM ('BOUNCE', 'COMPLAINT', 'MANUAL');

-- CreateTable
CREATE TABLE "email_messages" (
    "id" UUID NOT NULL,
    "to_address" VARCHAR(254) NOT NULL,
    "to_hash" CHAR(64) NOT NULL,
    "template" VARCHAR(60) NOT NULL,
    "variables" JSONB,
    "subject" VARCHAR(200) NOT NULL,
    "status" "message_status" NOT NULL DEFAULT 'QUEUED',
    "provider_id" VARCHAR(120),
    "provider_status" VARCHAR(40),
    "failure_reason" VARCHAR(200),
    "idempotency_key" VARCHAR(120) NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_event_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_events" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "event_id" VARCHAR(200) NOT NULL,
    "event_type" VARCHAR(60) NOT NULL,
    "message_id" UUID,
    "outcome" VARCHAR(40),
    "occurred_at" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_suppressions" (
    "address_hash" CHAR(64) NOT NULL,
    "address" VARCHAR(254) NOT NULL,
    "reason" "suppression_reason" NOT NULL,
    "source" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("address_hash")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_idempotency_key_key" ON "email_messages"("idempotency_key");

-- CreateIndex
CREATE INDEX "email_messages_to_hash_created_at_idx" ON "email_messages"("to_hash", "created_at" DESC);

-- CreateIndex
CREATE INDEX "email_messages_status_created_at_idx" ON "email_messages"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "email_messages_created_at_idx" ON "email_messages"("created_at" DESC);

-- CreateIndex
CREATE INDEX "email_events_message_id_received_at_idx" ON "email_events"("message_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_events_provider_event_id_key" ON "email_events"("provider", "event_id");

-- CreateIndex
CREATE INDEX "email_suppressions_created_at_idx" ON "email_suppressions"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "email_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

