-- Invariants a settlement must never violate, enforced by the database.

-- A payout is never negative: settlement pays out or it does not.
ALTER TABLE "settlements"
  ADD CONSTRAINT "settlements_payout_non_negative" CHECK ("payout" >= 0);

-- A losing bet pays nothing. Without this, a sign or branch error could
-- credit a loser.
ALTER TABLE "settlements"
  ADD CONSTRAINT "settlements_loss_pays_nothing"
  CHECK ("outcome" <> 'LOST' OR "payout" = 0);

ALTER TABLE "settlements"
  ADD CONSTRAINT "settlements_currency_iso4217"
  CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "settlements"
  ADD CONSTRAINT "settlements_revision_positive" CHECK ("revision" >= 1);

-- The first settlement supersedes nothing; a correction always does.
ALTER TABLE "settlements"
  ADD CONSTRAINT "settlements_supersedes_matches_revision" CHECK (
    ("revision" = 1 AND "supersedes_id" IS NULL)
    OR ("revision" > 1 AND "supersedes_id" IS NOT NULL)
  );

-- Settlement records are the audit trail for money paid out. They are
-- written once; a re-settlement is a new row at a higher revision.
CREATE OR REPLACE FUNCTION "settlements_reject_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'settlements is append-only: % is not permitted. Write a superseding '
    'settlement at the next revision instead.', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "settlements_no_update"
  BEFORE UPDATE ON "settlements"
  FOR EACH ROW EXECUTE FUNCTION "settlements_reject_mutation"();

CREATE TRIGGER "settlements_no_delete"
  BEFORE DELETE ON "settlements"
  FOR EACH ROW EXECUTE FUNCTION "settlements_reject_mutation"();
