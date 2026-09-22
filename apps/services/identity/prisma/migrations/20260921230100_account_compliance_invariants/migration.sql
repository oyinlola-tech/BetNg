-- Constraints and triggers Prisma cannot express, for the account-security, KYC and responsible-gaming tables.

-- The responsible-gaming history is what a regulator reads; nothing may rewrite it.
CREATE FUNCTION "rg_limit_history_reject_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'identity.rg_limit_history is append-only (% refused)', TG_OP
    USING ERRCODE = 'restrict_violation';
END
$$;

CREATE TRIGGER "rg_limit_history_append_only"
  BEFORE UPDATE OR DELETE ON "rg_limit_history"
  FOR EACH ROW EXECUTE FUNCTION "rg_limit_history_reject_mutation"();

CREATE TRIGGER "rg_limit_history_no_truncate"
  BEFORE TRUNCATE ON "rg_limit_history"
  FOR EACH STATEMENT EXECUTE FUNCTION "rg_limit_history_reject_mutation"();

ALTER TABLE "rg_limits" ADD CONSTRAINT "rg_limits_kind_known"
  CHECK ("kind" IN ('deposit_daily', 'deposit_weekly', 'deposit_monthly', 'loss_daily', 'loss_weekly', 'session_minutes'));
ALTER TABLE "rg_limits" ADD CONSTRAINT "rg_limits_value_positive" CHECK ("value" > 0);
ALTER TABLE "rg_limits" ADD CONSTRAINT "rg_limits_pending_consistent"
  CHECK (("pending_value" IS NULL) = ("pending_effective_at" IS NULL));
ALTER TABLE "rg_limits" ADD CONSTRAINT "rg_limits_pending_loosens"
  CHECK ("pending_value" IS NULL OR "pending_value" > "value");

ALTER TABLE "rg_limit_history" ADD CONSTRAINT "rg_limit_history_kind_known"
  CHECK ("kind" IN ('deposit_daily', 'deposit_weekly', 'deposit_monthly', 'loss_daily', 'loss_weekly', 'session_minutes', 'self_exclude'));
ALTER TABLE "rg_limit_history" ADD CONSTRAINT "rg_limit_history_action_known"
  CHECK ("action" IN ('SET', 'RAISED', 'LOWERED', 'REMOVED', 'EXPIRED', 'EXCLUDED'));

ALTER TABLE "rg_self_exclusions" ADD CONSTRAINT "rg_self_exclusions_period_known"
  CHECK ("period" IN ('24h', '7d', '30d', '6m', 'permanent'));
ALTER TABLE "rg_self_exclusions" ADD CONSTRAINT "rg_self_exclusions_permanent_has_no_end"
  CHECK (("period" = 'permanent') = ("ends_at" IS NULL));

ALTER TABLE "rg_limit_refusals" ADD CONSTRAINT "rg_limit_refusals_action_known"
  CHECK ("action" IN ('DEPOSIT', 'BET', 'WITHDRAWAL'));

-- One live deletion request per customer.
CREATE UNIQUE INDEX "account_deletions_one_pending" ON "account_deletions" ("customer_id") WHERE "status" = 'PENDING';

-- A BVN or NIN verified for one customer cannot verify a second one.
CREATE UNIQUE INDEX "kyc_identity_checks_verified_number" ON "kyc_identity_checks" ("check", "number_hash") WHERE "status" = 'VERIFIED';

ALTER TABLE "kyc_identity_checks" ADD CONSTRAINT "kyc_identity_checks_last4_digits" CHECK ("number_last4" ~ '^[0-9]{4}$');

ALTER TABLE "kyc_uploads" ADD CONSTRAINT "kyc_uploads_size_bounded" CHECK ("size_bytes" > 0 AND "size_bytes" <= 10485760);
ALTER TABLE "kyc_uploads" ADD CONSTRAINT "kyc_uploads_content_type_known"
  CHECK ("content_type" IN ('image/jpeg', 'image/png', 'application/pdf'));
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_size_bounded" CHECK ("size_bytes" > 0 AND "size_bytes" <= 10485760);

ALTER TABLE "two_factor_enrollments" ADD CONSTRAINT "two_factor_enrollments_attempts_nonnegative" CHECK ("attempts" >= 0);
ALTER TABLE "login_challenges" ADD CONSTRAINT "login_challenges_attempts_nonnegative" CHECK ("attempts" >= 0);
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_attempts_nonnegative" CHECK ("attempts" >= 0);

-- Revoked sessions whose gateway cache entry has not been deleted yet; the eviction sweep reads this.
CREATE INDEX "sessions_eviction_pending" ON "sessions" ("revoked_at")
  WHERE "revoked_at" IS NOT NULL AND "cache_evicted_at" IS NULL;
