-- Invariants the settlement schema must never violate, enforced by the database.
--
-- `operator_result`, `gross_operator_result` and `platform_share_amount` may be NEGATIVE: a period in which
-- payouts exceed stakes is recorded exactly as it happened. Nothing here constrains them to be >= 0.

-- Enumerations (text columns so every reader sees plain strings).
ALTER TABLE "settlements"
  ADD CONSTRAINT "settlements_outcome_known" CHECK ("outcome" IN ('WON', 'LOST', 'VOID')),
  ADD CONSTRAINT "settlements_channel_known" CHECK ("channel" IN ('ONLINE', 'SHOP')),
  ADD CONSTRAINT "settlements_revision_positive" CHECK ("revision" >= 1),
  ADD CONSTRAINT "settlements_stake_non_negative" CHECK ("stake" >= 0),
  ADD CONSTRAINT "settlements_payout_non_negative" CHECK ("payout" >= 0),
  -- A losing bet pays nothing and a void bet pays exactly its stake back.
  ADD CONSTRAINT "settlements_loss_pays_nothing" CHECK ("outcome" <> 'LOST' OR "payout" = 0),
  ADD CONSTRAINT "settlements_void_refunds_stake" CHECK ("outcome" <> 'VOID' OR "payout" = "stake");

ALTER TABLE "settled_selections"
  ADD CONSTRAINT "settled_selections_outcome_known" CHECK ("outcome" IN ('WON', 'LOST', 'VOID'));

ALTER TABLE "match_settlements"
  ADD CONSTRAINT "match_settlements_kind_known" CHECK ("kind" IN ('RESULT', 'VOID')),
  ADD CONSTRAINT "match_settlements_status_known" CHECK ("status" IN ('STARTED', 'COMPLETED', 'FAILED')),
  ADD CONSTRAINT "match_settlements_counts_non_negative"
    CHECK ("bets_total" >= 0 AND "bets_settled" >= 0 AND "attempts" >= 0),
  ADD CONSTRAINT "match_settlements_completed_has_instant"
    CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL));

ALTER TABLE "operator_periods"
  ADD CONSTRAINT "operator_periods_id_format" CHECK ("id" ~ '^SESSION-[0-9]{8}-[0-9]{4}$'),
  ADD CONSTRAINT "operator_periods_kind_known" CHECK ("kind" IN ('HOUR', 'DAY', 'MATCHDAY', 'ROUND', 'CUSTOM')),
  ADD CONSTRAINT "operator_periods_status_known" CHECK ("status" IN ('OPEN', 'CLOSED')),
  ADD CONSTRAINT "operator_periods_closed_has_end" CHECK (("status" = 'CLOSED') = ("ends_at" IS NOT NULL)),
  ADD CONSTRAINT "operator_periods_end_after_start" CHECK ("ends_at" IS NULL OR "ends_at" >= "starts_at");

-- At most one period is open at a time.
CREATE UNIQUE INDEX "operator_periods_single_open" ON "operator_periods" ((TRUE)) WHERE "status" = 'OPEN';

ALTER TABLE "operator_ledger_entries"
  ADD CONSTRAINT "operator_ledger_entries_outcome_known" CHECK ("outcome" IN ('WON', 'LOST', 'VOID')),
  ADD CONSTRAINT "operator_ledger_entries_channel_known" CHECK ("channel" IN ('ONLINE', 'SHOP')),
  ADD CONSTRAINT "operator_ledger_entries_stake_non_negative" CHECK ("stake" >= 0),
  ADD CONSTRAINT "operator_ledger_entries_payout_non_negative" CHECK ("payout" >= 0);

ALTER TABLE "operator_ledger"
  ADD CONSTRAINT "operator_ledger_status_known" CHECK ("status" IN ('CLOSED')),
  ADD CONSTRAINT "operator_ledger_stakes_non_negative" CHECK ("gross_stakes" >= 0),
  ADD CONSTRAINT "operator_ledger_payouts_non_negative" CHECK ("gross_payouts" >= 0),
  ADD CONSTRAINT "operator_ledger_refunds_non_negative" CHECK ("refunded_stakes" >= 0),
  ADD CONSTRAINT "operator_ledger_counts_non_negative" CHECK ("settled_bets" >= 0 AND "void_bets" >= 0),
  ADD CONSTRAINT "operator_ledger_result_is_stakes_minus_payouts"
    CHECK ("operator_result" = "gross_stakes" - "gross_payouts");

ALTER TABLE "commission_config"
  ADD CONSTRAINT "commission_config_percent_range" CHECK ("shop_share_percent" BETWEEN 0 AND 100);

ALTER TABLE "commission_ledger"
  ADD CONSTRAINT "commission_ledger_stakes_non_negative" CHECK ("gross_stakes" >= 0),
  ADD CONSTRAINT "commission_ledger_payouts_non_negative" CHECK ("gross_payouts" >= 0),
  ADD CONSTRAINT "commission_ledger_result_is_stakes_minus_payouts"
    CHECK ("gross_operator_result" = "gross_stakes" - "gross_payouts"),
  ADD CONSTRAINT "commission_ledger_shop_percent_range" CHECK ("shop_share_percent" BETWEEN 0 AND 100),
  ADD CONSTRAINT "commission_ledger_platform_percent_range" CHECK ("platform_share_percent" BETWEEN 0 AND 100),
  ADD CONSTRAINT "commission_ledger_percents_sum" CHECK ("shop_share_percent" + "platform_share_percent" = 100),
  -- A shop shares in a positive result only; a negative result stays whole on the platform side.
  ADD CONSTRAINT "commission_ledger_shop_share_non_negative" CHECK ("shop_share_amount" >= 0),
  ADD CONSTRAINT "commission_ledger_no_share_of_a_loss"
    CHECK ("gross_operator_result" > 0 OR "shop_share_amount" = 0),
  ADD CONSTRAINT "commission_ledger_shares_sum"
    CHECK ("shop_share_amount" + "platform_share_amount" = "gross_operator_result");

-- The retry loop reads settlements whose effects have not been applied yet.
CREATE INDEX "settlements_effects_pending" ON "settlements" ("settled_at") WHERE "effects_applied_at" IS NULL;

-- Append-only tables. A correction is a new row, never an edit.
CREATE FUNCTION "reject_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not permitted.', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

-- `settlements.effects_applied_at` is the single exception: it is set once, from NULL, and nothing else moves.
CREATE FUNCTION "settlements_guard_update"() RETURNS TRIGGER AS $$
BEGIN
  IF OLD."effects_applied_at" IS NOT NULL OR NEW."effects_applied_at" IS NULL THEN
    RAISE EXCEPTION 'settlements is append-only: effects_applied_at is set once.'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF (to_jsonb(NEW) - 'effects_applied_at') IS DISTINCT FROM (to_jsonb(OLD) - 'effects_applied_at') THEN
    RAISE EXCEPTION 'settlements is append-only: only effects_applied_at may be set.'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "settlements_guard_update" BEFORE UPDATE ON "settlements"
  FOR EACH ROW EXECUTE FUNCTION "settlements_guard_update"();
CREATE TRIGGER "settlements_no_delete" BEFORE DELETE ON "settlements"
  FOR EACH ROW EXECUTE FUNCTION "reject_mutation"();
CREATE TRIGGER "settlements_no_truncate" BEFORE TRUNCATE ON "settlements"
  FOR EACH STATEMENT EXECUTE FUNCTION "reject_mutation"();

CREATE TRIGGER "settled_selections_append_only" BEFORE UPDATE OR DELETE ON "settled_selections"
  FOR EACH ROW EXECUTE FUNCTION "reject_mutation"();
CREATE TRIGGER "settled_selections_no_truncate" BEFORE TRUNCATE ON "settled_selections"
  FOR EACH STATEMENT EXECUTE FUNCTION "reject_mutation"();

CREATE TRIGGER "operator_ledger_entries_append_only" BEFORE UPDATE OR DELETE ON "operator_ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION "reject_mutation"();
CREATE TRIGGER "operator_ledger_entries_no_truncate" BEFORE TRUNCATE ON "operator_ledger_entries"
  FOR EACH STATEMENT EXECUTE FUNCTION "reject_mutation"();

CREATE TRIGGER "operator_ledger_append_only" BEFORE UPDATE OR DELETE ON "operator_ledger"
  FOR EACH ROW EXECUTE FUNCTION "reject_mutation"();
CREATE TRIGGER "operator_ledger_no_truncate" BEFORE TRUNCATE ON "operator_ledger"
  FOR EACH STATEMENT EXECUTE FUNCTION "reject_mutation"();

CREATE TRIGGER "commission_ledger_append_only" BEFORE UPDATE OR DELETE ON "commission_ledger"
  FOR EACH ROW EXECUTE FUNCTION "reject_mutation"();
CREATE TRIGGER "commission_ledger_no_truncate" BEFORE TRUNCATE ON "commission_ledger"
  FOR EACH STATEMENT EXECUTE FUNCTION "reject_mutation"();

-- Commission configuration is versioned by `effective_from`, never edited in place.
CREATE TRIGGER "commission_config_append_only" BEFORE UPDATE OR DELETE ON "commission_config"
  FOR EACH ROW EXECUTE FUNCTION "reject_mutation"();

-- A closed period is final, and no period is ever deleted.
CREATE FUNCTION "operator_periods_guard"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD."status" = 'CLOSED' THEN
    RAISE EXCEPTION 'operator_periods: a period is never deleted and a closed period never changes.'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW."id" <> OLD."id" OR NEW."kind" <> OLD."kind" OR NEW."starts_at" <> OLD."starts_at" THEN
    RAISE EXCEPTION 'operator_periods: only status and ends_at change, once, when the period closes.'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "operator_periods_guard" BEFORE UPDATE OR DELETE ON "operator_periods"
  FOR EACH ROW EXECUTE FUNCTION "operator_periods_guard"();
