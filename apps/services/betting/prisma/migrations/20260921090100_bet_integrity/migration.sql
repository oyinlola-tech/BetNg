-- Money and immutability invariants of a bet, enforced by the database.

ALTER TABLE "bets" ADD CONSTRAINT "bets_stake_positive" CHECK ("stake" > 0);

ALTER TABLE "bets"
  ADD CONSTRAINT "bets_total_odds_above_one" CHECK ("total_odds" > 1);

ALTER TABLE "bets"
  ADD CONSTRAINT "bets_payout_covers_stake"
  CHECK ("potential_payout" >= "stake");

-- Settlement may pay less than the promise (a void leg), never more.
ALTER TABLE "bets"
  ADD CONSTRAINT "bets_payout_bounded"
  CHECK ("payout" IS NULL OR ("payout" >= 0 AND "payout" <= "potential_payout"));

ALTER TABLE "bets"
  ADD CONSTRAINT "bets_currency_iso4217" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "bet_selections"
  ADD CONSTRAINT "bet_selections_odds_above_one" CHECK ("odds" > 1);

ALTER TABLE "bet_selections"
  ADD CONSTRAINT "bet_selections_odds_version_positive" CHECK ("odds_version" >= 1);

ALTER TABLE "bets"
  ADD CONSTRAINT "bets_resolution_matches_status" CHECK (
    ("status" = 'PENDING'
      AND "settled_at" IS NULL AND "cancelled_at" IS NULL AND "payout" IS NULL)
    OR ("status" IN ('WON', 'LOST', 'VOID')
      AND "settled_at" IS NOT NULL AND "cancelled_at" IS NULL AND "payout" IS NOT NULL)
    OR ("status" = 'CANCELLED'
      AND "cancelled_at" IS NOT NULL AND "settled_at" IS NULL)
  );

-- Online bets belong to a customer, shop bets to a shop and cashier; there is no operator bettor.
ALTER TABLE "bets"
  ADD CONSTRAINT "bets_owner_matches_channel" CHECK (
    ("channel" = 'ONLINE'
      AND "user_id" IS NOT NULL AND "shop_id" IS NULL AND "cashier_id" IS NULL)
    OR ("channel" = 'SHOP'
      AND "user_id" IS NULL AND "shop_id" IS NOT NULL AND "cashier_id" IS NOT NULL)
  );

ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_paid_fields_match_status" CHECK (
    ("status" = 'PAID') = ("paid_at" IS NOT NULL AND "paid_by" IS NOT NULL)
  );

ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_code_format" CHECK ("code" ~ '^[A-Z0-9]{10,12}$');

-- A bet is written once; only PENDING -> WON|LOST|VOID|CANCELLED may follow, exactly once.
CREATE FUNCTION "bets_guard_update"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" <> 'PENDING' THEN
    RAISE EXCEPTION 'bet % is already % and cannot change', OLD."id", OLD."status"
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."status" = 'PENDING' THEN
    RAISE EXCEPTION 'bet % may only be updated to resolve it', OLD."id"
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."user_id" IS DISTINCT FROM OLD."user_id"
    OR NEW."channel" IS DISTINCT FROM OLD."channel"
    OR NEW."shop_id" IS DISTINCT FROM OLD."shop_id"
    OR NEW."cashier_id" IS DISTINCT FROM OLD."cashier_id"
    OR NEW."stake" IS DISTINCT FROM OLD."stake"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."total_odds" IS DISTINCT FROM OLD."total_odds"
    OR NEW."potential_payout" IS DISTINCT FROM OLD."potential_payout"
    OR NEW."risk_decision_id" IS DISTINCT FROM OLD."risk_decision_id"
    OR NEW."idempotency_key" IS DISTINCT FROM OLD."idempotency_key"
    OR NEW."placed_at" IS DISTINCT FROM OLD."placed_at"
  THEN
    RAISE EXCEPTION 'bet % is immutable apart from its resolution', OLD."id"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "bets_immutable_update"
  BEFORE UPDATE ON "bets"
  FOR EACH ROW EXECUTE FUNCTION "bets_guard_update"();

-- A leg changes only its outcome and result, once, from PENDING.
CREATE FUNCTION "bet_selections_guard_update"() RETURNS trigger AS $$
BEGIN
  IF OLD."outcome" <> 'PENDING' THEN
    RAISE EXCEPTION 'selection % is already % and cannot change', OLD."id", OLD."outcome"
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."outcome" = 'PENDING' THEN
    RAISE EXCEPTION 'selection % may only be updated to resolve it', OLD."id"
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."bet_id" IS DISTINCT FROM OLD."bet_id"
    OR NEW."match_id" IS DISTINCT FROM OLD."match_id"
    OR NEW."market_id" IS DISTINCT FROM OLD."market_id"
    OR NEW."selection_id" IS DISTINCT FROM OLD."selection_id"
    OR NEW."league_id" IS DISTINCT FROM OLD."league_id"
    OR NEW."market_type" IS DISTINCT FROM OLD."market_type"
    OR NEW."selection_code" IS DISTINCT FROM OLD."selection_code"
    OR NEW."line" IS DISTINCT FROM OLD."line"
    OR NEW."odds" IS DISTINCT FROM OLD."odds"
    OR NEW."odds_version" IS DISTINCT FROM OLD."odds_version"
    OR NEW."market_label" IS DISTINCT FROM OLD."market_label"
    OR NEW."selection_label" IS DISTINCT FROM OLD."selection_label"
    OR NEW."match_label" IS DISTINCT FROM OLD."match_label"
    OR NEW."league_name" IS DISTINCT FROM OLD."league_name"
    OR NEW."kickoff_at" IS DISTINCT FROM OLD."kickoff_at"
  THEN
    RAISE EXCEPTION 'selection % is immutable apart from its outcome', OLD."id"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "bet_selections_immutable_update"
  BEFORE UPDATE ON "bet_selections"
  FOR EACH ROW EXECUTE FUNCTION "bet_selections_guard_update"();

-- Accepted bets are resolved, never deleted.
CREATE FUNCTION "bets_reject_delete"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'rows in %.% are never deleted', TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "bets_no_delete"
  BEFORE DELETE ON "bets"
  FOR EACH ROW EXECUTE FUNCTION "bets_reject_delete"();

CREATE TRIGGER "bet_selections_no_delete"
  BEFORE DELETE ON "bet_selections"
  FOR EACH ROW EXECUTE FUNCTION "bets_reject_delete"();

CREATE TRIGGER "tickets_no_delete"
  BEFORE DELETE ON "tickets"
  FOR EACH ROW EXECUTE FUNCTION "bets_reject_delete"();
