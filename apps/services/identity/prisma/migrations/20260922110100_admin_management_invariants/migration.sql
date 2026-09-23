-- Constraints and triggers Prisma cannot express.
-- The platform must always have exactly one way in and never zero: at most one bootstrap account,
-- and never fewer than one active super administrator.

-- The bootstrap account is created once, by `pnpm db:migrate`, and never again.
CREATE UNIQUE INDEX "admin_users_one_bootstrap" ON "admin_users" (("is_bootstrap")) WHERE "is_bootstrap";

-- A one-time password must carry an expiry, and an expiry only makes sense for a one-time password.
ALTER TABLE "admin_users"
  ADD CONSTRAINT "admin_users_temporary_credentials_expire"
  CHECK (NOT "must_change_password" OR "credentials_expire_at" IS NOT NULL);

/*
 * Locking out every administrator is unrecoverable without database access, so the last active super
 * administrator cannot be suspended, demoted or deleted. Checked after the statement so a transaction
 * that promotes one account and demotes another in either order is allowed.
 */
CREATE OR REPLACE FUNCTION "admin_users_keep_a_super_admin"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM "admin_users" WHERE "role" = 'SUPER_ADMIN' AND "status" = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'at least one active super administrator must remain'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER "admin_users_keep_a_super_admin"
AFTER UPDATE OR DELETE ON "admin_users"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "admin_users_keep_a_super_admin"();

-- The bootstrap flag is set once, at creation, and can only ever be cleared.
CREATE OR REPLACE FUNCTION "admin_users_bootstrap_flag_is_final"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."is_bootstrap" AND NOT OLD."is_bootstrap" THEN
    RAISE EXCEPTION 'an existing administrator cannot become the bootstrap account'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "admin_users_bootstrap_flag_is_final"
BEFORE UPDATE ON "admin_users"
FOR EACH ROW EXECUTE FUNCTION "admin_users_bootstrap_flag_is_final"();
