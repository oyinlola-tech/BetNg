-- Constraints and triggers Prisma cannot express.
-- Float moves between two drawers in one shop. It never moves to itself, never moves nothing, and never
-- moves out of the shop: the pair of ledger rows sums to zero, so the shop's balance is untouched.

ALTER TABLE "shop_float_transfers"
  ADD CONSTRAINT "shop_float_transfers_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "shop_float_transfers_amount_in_range" CHECK ("amount" <= 9007199254740991),
  ADD CONSTRAINT "shop_float_transfers_distinct_cashiers" CHECK ("from_cashier_id" <> "to_cashier_id"),
  ADD CONSTRAINT "shop_float_transfers_distinct_shifts" CHECK ("from_shift_id" <> "to_shift_id"),
  ADD CONSTRAINT "shop_float_transfers_note_present" CHECK (length(btrim("note")) >= 3);

-- A transfer is a record of something that happened; it is never rewritten or removed.
CREATE OR REPLACE FUNCTION "shop_float_transfers_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'shop_float_transfers is append-only' USING ERRCODE = 'restrict_violation';
END
$$;

CREATE TRIGGER "shop_float_transfers_append_only"
BEFORE UPDATE OR DELETE ON "shop_float_transfers"
FOR EACH ROW EXECUTE FUNCTION "shop_float_transfers_append_only"();

CREATE TRIGGER "shop_float_transfers_no_truncate"
BEFORE TRUNCATE ON "shop_float_transfers"
FOR EACH STATEMENT EXECUTE FUNCTION "shop_float_transfers_append_only"();

/*
 * Both halves of a transfer must exist and sum to zero. Checked at COMMIT, because the two ledger rows are
 * written one after the other inside one transaction: a constraint checked per statement would reject the
 * first before the second could exist.
 */
CREATE OR REPLACE FUNCTION "shop_float_transfers_net_zero"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  moved bigint;
  halves int;
BEGIN
  SELECT COALESCE(SUM(t."amount"), 0), COUNT(*)
    INTO moved, halves
    FROM "wallet_transactions" t
    JOIN "wallet_accounts" a ON a."id" = t."account_id"
   WHERE t."reference" = 'transfer:' || NEW."id"
     AND a."owner_type" = 'SHOP'
     AND a."owner_id" = NEW."shop_id";

  IF halves <> 2 OR moved <> 0 THEN
    RAISE EXCEPTION
      'a float transfer must be two ledger rows on the shop account summing to zero (got % rows, net %)',
      halves, moved
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER "shop_float_transfers_net_zero"
AFTER INSERT ON "shop_float_transfers"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "shop_float_transfers_net_zero"();
