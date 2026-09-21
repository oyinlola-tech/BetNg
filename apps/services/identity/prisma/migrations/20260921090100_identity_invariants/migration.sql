-- Constraints and triggers Prisma cannot express.

-- The audit log is append-only: nothing, this service included, may rewrite history.
CREATE FUNCTION "audit_logs_reject_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'identity.audit_logs is append-only (% refused)', TG_OP
    USING ERRCODE = 'restrict_violation';
END
$$;

CREATE TRIGGER "audit_logs_append_only"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_reject_mutation"();

CREATE TRIGGER "audit_logs_no_truncate"
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_logs_reject_mutation"();

-- Architecture invariant 9: an admin user is never a customer. The tables are
-- separate; these triggers also refuse the same e-mail address on both sides,
-- so no customer row (and therefore no wallet) can exist for an admin.
CREATE FUNCTION "customers_reject_admin_email"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "admin_users" WHERE lower("email") = lower(NEW."email")) THEN
    RAISE EXCEPTION 'an admin user cannot be a customer'
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "customers_admin_separation"
  BEFORE INSERT OR UPDATE OF "email" ON "customers"
  FOR EACH ROW EXECUTE FUNCTION "customers_reject_admin_email"();

CREATE FUNCTION "admin_users_reject_customer_email"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "customers" WHERE lower("email") = lower(NEW."email")) THEN
    RAISE EXCEPTION 'a customer cannot be an admin user'
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "admin_users_customer_separation"
  BEFORE INSERT OR UPDATE OF "email" ON "admin_users"
  FOR EACH ROW EXECUTE FUNCTION "admin_users_reject_customer_email"();

-- Identifiers are stored normalised so a lookup never depends on the caller's casing.
ALTER TABLE "customers" ADD CONSTRAINT "customers_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "cashiers" ADD CONSTRAINT "cashiers_username_lowercase" CHECK ("username" = lower("username"));
ALTER TABLE "shops" ADD CONSTRAINT "shops_code_uppercase" CHECK ("code" = upper("code"));

-- Two-factor authentication cannot be switched on without a secret to check against.
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_totp_secret_present"
  CHECK (NOT "two_factor_enabled" OR "totp_secret" IS NOT NULL);

ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_attempts_nonnegative" CHECK ("attempts" >= 0);
ALTER TABLE "login_throttles" ADD CONSTRAINT "login_throttles_failures_nonnegative" CHECK ("failures" >= 0);

-- Platform settings are one document, not a table of them.
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_single_row" CHECK ("id" = 1);
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_version_positive" CHECK ("version" >= 1);
