-- CreateEnum
CREATE TYPE "kyc_status" AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED', 'REQUIRES_ACTION');

-- CreateEnum
CREATE TYPE "kyc_document_type" AS ENUM ('NATIONAL_ID', 'PASSPORT', 'DRIVERS_LICENSE', 'VOTERS_CARD', 'PROOF_OF_ADDRESS', 'SELFIE');

-- CreateEnum
CREATE TYPE "identity_check_kind" AS ENUM ('BVN', 'NIN');

-- CreateEnum
CREATE TYPE "account_deletion_status" AS ENUM ('PENDING', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "push_platform" AS ENUM ('web', 'ios', 'android');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "deleted_at" TIMESTAMPTZ(3),
ADD COLUMN     "password_changed_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "password_resets" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "browser" VARCHAR(80),
ADD COLUMN     "cache_evicted_at" TIMESTAMPTZ(3),
ADD COLUMN     "device" VARCHAR(80),
ADD COLUMN     "platform" VARCHAR(80);

-- CreateTable
CREATE TABLE "customer_two_factor" (
    "customer_id" UUID NOT NULL,
    "secret_ciphertext" TEXT NOT NULL,
    "last_step" BIGINT,
    "enabled_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_two_factor_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "two_factor_enrollments" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "secret_ciphertext" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_codes" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_challenges" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "device" VARCHAR(80),
    "browser" VARCHAR(80),
    "platform" VARCHAR(80),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_history" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_deletions" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "account_deletion_status" NOT NULL DEFAULT 'PENDING',
    "reason" VARCHAR(500),
    "idempotency_key" VARCHAR(120) NOT NULL,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_for" TIMESTAMPTZ(3) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "account_deletions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "customer_id" UUID NOT NULL,
    "channels" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "push_devices" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "platform" "push_platform" NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_ciphertext" TEXT NOT NULL,
    "session_id" UUID,
    "registered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3),

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_uploads" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "type" "kyc_document_type" NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "content_type" VARCHAR(40) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "object_key" VARCHAR(200) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_documents" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "type" "kyc_document_type" NOT NULL,
    "status" "kyc_status" NOT NULL DEFAULT 'PENDING',
    "file_name" VARCHAR(200) NOT NULL,
    "content_type" VARCHAR(40) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "object_key" VARCHAR(200) NOT NULL,
    "uploaded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(3),
    "reviewed_by" VARCHAR(80),
    "rejection_reason" VARCHAR(300),

    CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_identity_checks" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "check" "identity_check_kind" NOT NULL,
    "status" "kyc_status" NOT NULL,
    "number_hash" TEXT NOT NULL,
    "number_last4" VARCHAR(4) NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "provider_reference" VARCHAR(120),
    "message" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_identity_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_profiles" (
    "customer_id" UUID NOT NULL,
    "decision" "kyc_status" NOT NULL,
    "reason" VARCHAR(300),
    "reviewed_at" TIMESTAMPTZ(3) NOT NULL,
    "reviewed_by" VARCHAR(80) NOT NULL,

    CONSTRAINT "kyc_profiles_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "rg_limits" (
    "customer_id" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "value" BIGINT NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "pending_value" BIGINT,
    "pending_effective_at" TIMESTAMPTZ(3),
    "removal_effective_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rg_limits_pkey" PRIMARY KEY ("customer_id","kind")
);

-- CreateTable
CREATE TABLE "rg_limit_history" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "action" VARCHAR(10) NOT NULL,
    "previous_value" BIGINT,
    "value" BIGINT,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rg_limit_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rg_self_exclusions" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "period" VARCHAR(10) NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(3),
    "can_cancel_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),

    CONSTRAINT "rg_self_exclusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rg_limit_refusals" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "action" VARCHAR(12) NOT NULL,
    "code" VARCHAR(24) NOT NULL,
    "amount" BIGINT NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rg_limit_refusals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "two_factor_enrollments_customer_id_created_at_idx" ON "two_factor_enrollments"("customer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "backup_codes_code_hash_key" ON "backup_codes"("code_hash");

-- CreateIndex
CREATE INDEX "backup_codes_customer_id_idx" ON "backup_codes"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "login_challenges_token_hash_key" ON "login_challenges"("token_hash");

-- CreateIndex
CREATE INDEX "login_challenges_customer_id_created_at_idx" ON "login_challenges"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "login_challenges_expires_at_idx" ON "login_challenges"("expires_at");

-- CreateIndex
CREATE INDEX "password_history_customer_id_created_at_idx" ON "password_history"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "account_deletions_status_scheduled_for_idx" ON "account_deletions"("status", "scheduled_for");

-- CreateIndex
CREATE UNIQUE INDEX "account_deletions_customer_id_idempotency_key_key" ON "account_deletions"("customer_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "push_devices_token_hash_key" ON "push_devices"("token_hash");

-- CreateIndex
CREATE INDEX "push_devices_customer_id_registered_at_idx" ON "push_devices"("customer_id", "registered_at");

-- CreateIndex
CREATE INDEX "kyc_uploads_customer_id_created_at_idx" ON "kyc_uploads"("customer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_documents_object_key_key" ON "kyc_documents"("object_key");

-- CreateIndex
CREATE INDEX "kyc_documents_customer_id_uploaded_at_idx" ON "kyc_documents"("customer_id", "uploaded_at");

-- CreateIndex
CREATE INDEX "kyc_documents_status_uploaded_at_idx" ON "kyc_documents"("status", "uploaded_at");

-- CreateIndex
CREATE INDEX "kyc_identity_checks_customer_id_check_created_at_idx" ON "kyc_identity_checks"("customer_id", "check", "created_at" DESC);

-- CreateIndex
CREATE INDEX "rg_limit_history_customer_id_at_idx" ON "rg_limit_history"("customer_id", "at" DESC);

-- CreateIndex
CREATE INDEX "rg_self_exclusions_customer_id_started_at_idx" ON "rg_self_exclusions"("customer_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "rg_limit_refusals_customer_id_at_idx" ON "rg_limit_refusals"("customer_id", "at" DESC);

-- CreateIndex
CREATE INDEX "rg_limit_refusals_at_idx" ON "rg_limit_refusals"("at");

-- AddForeignKey
ALTER TABLE "customer_two_factor" ADD CONSTRAINT "customer_two_factor_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_enrollments" ADD CONSTRAINT "two_factor_enrollments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_codes" ADD CONSTRAINT "backup_codes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_challenges" ADD CONSTRAINT "login_challenges_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_deletions" ADD CONSTRAINT "account_deletions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_uploads" ADD CONSTRAINT "kyc_uploads_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_identity_checks" ADD CONSTRAINT "kyc_identity_checks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_profiles" ADD CONSTRAINT "kyc_profiles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rg_limits" ADD CONSTRAINT "rg_limits_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rg_limit_history" ADD CONSTRAINT "rg_limit_history_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rg_self_exclusions" ADD CONSTRAINT "rg_self_exclusions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rg_limit_refusals" ADD CONSTRAINT "rg_limit_refusals_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
