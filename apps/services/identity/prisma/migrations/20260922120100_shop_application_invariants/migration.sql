-- Constraints and triggers Prisma cannot express.
-- One live application per address, a decision that cannot be rewritten, and an approval that must name
-- the shop it created.

ALTER TABLE "shop_applications"
  ADD CONSTRAINT "shop_applications_email_lowercase" CHECK ("applicant_email" = lower("applicant_email")),
  ADD CONSTRAINT "shop_applications_reference_shape" CHECK ("reference" ~ '^BNGA-[0-9A-HJ-NP-Z]{16,}$'),
  -- A decision is a status, a moment, a reviewer and a reason, together or not at all.
  ADD CONSTRAINT "shop_applications_decision_complete" CHECK (
    ("status" = 'PENDING' AND "decided_at" IS NULL AND "decided_by" IS NULL)
    OR ("status" <> 'PENDING' AND "decided_at" IS NOT NULL AND "decided_by" IS NOT NULL)
  ),
  -- An approval creates a shop; nothing else may claim one.
  ADD CONSTRAINT "shop_applications_approved_has_shop" CHECK (
    ("status" = 'APPROVED' AND "shop_id" IS NOT NULL) OR ("status" <> 'APPROVED' AND "shop_id" IS NULL)
  );

/*
 * Someone may apply again after being turned down, but not while one is waiting or already accepted:
 * two live applications for one address would mean two shops for one owner by accident.
 */
CREATE UNIQUE INDEX "shop_applications_one_live_per_email"
  ON "shop_applications" ("applicant_email")
  WHERE "status" IN ('PENDING', 'REQUIRES_ACTION', 'APPROVED');

-- A decided application is final: the record of what was decided, and when, is not rewritten.
CREATE OR REPLACE FUNCTION "shop_applications_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'shop_applications rows are never deleted' USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW."id" <> OLD."id" OR NEW."reference" <> OLD."reference" OR NEW."created_at" <> OLD."created_at" THEN
    RAISE EXCEPTION 'a shop application''s identity is immutable' USING ERRCODE = 'restrict_violation';
  END IF;

  -- REQUIRES_ACTION is the one decision that can be revisited, because it asks the applicant for more.
  IF OLD."status" IN ('APPROVED', 'REJECTED') AND NEW."status" <> OLD."status" THEN
    RAISE EXCEPTION 'shop application status % is final', OLD."status" USING ERRCODE = 'restrict_violation';
  END IF;

  IF OLD."shop_id" IS NOT NULL AND NEW."shop_id" IS DISTINCT FROM OLD."shop_id" THEN
    RAISE EXCEPTION 'the shop an application created cannot be changed' USING ERRCODE = 'restrict_violation';
  END IF;

  -- Proving an address happens once; it cannot be withdrawn to reopen a lookup.
  IF OLD."email_verified_at" IS NOT NULL AND NEW."email_verified_at" IS NULL THEN
    RAISE EXCEPTION 'a verified applicant address cannot become unverified' USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW."applicant_email" <> OLD."applicant_email" THEN
    RAISE EXCEPTION 'an applicant address cannot be changed' USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "shop_applications_guard"
BEFORE UPDATE OR DELETE ON "shop_applications"
FOR EACH ROW EXECUTE FUNCTION "shop_applications_guard"();

-- Applicant details are personal data, and so is a premises photo's key; the shared reader may not read them.
REVOKE ALL ON "shop_applications", "shop_application_documents", "shop_application_verifications" FROM betng_reader;
