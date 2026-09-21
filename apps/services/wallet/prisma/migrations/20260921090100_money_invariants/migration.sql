-- Money invariants enforced where the data lives, so they hold against any caller, script or future migration.

-- Holds even if a later migration adds an enum value: no operator or admin wallet can exist.
ALTER TABLE "wallet_accounts"
  ADD CONSTRAINT "wallet_accounts_owner_type_allowed"
  CHECK ("owner_type"::text IN ('CUSTOMER', 'SHOP'));

ALTER TABLE "wallet_accounts"
  ADD CONSTRAINT "wallet_accounts_balance_non_negative" CHECK ("balance" >= 0);

-- Amounts cross the wire as JSON integers (2^53 - 1).
ALTER TABLE "wallet_accounts"
  ADD CONSTRAINT "wallet_accounts_balance_safe_integer"
  CHECK ("balance" <= 9007199254740991);

ALTER TABLE "wallet_accounts"
  ADD CONSTRAINT "wallet_accounts_reserved_non_negative" CHECK ("reserved" >= 0);
ALTER TABLE "wallet_accounts"
  ADD CONSTRAINT "wallet_accounts_reserved_within_balance"
  CHECK ("reserved" <= "balance");

ALTER TABLE "wallet_accounts"
  ADD CONSTRAINT "wallet_accounts_currency_iso4217" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "wallet_accounts"
  ADD CONSTRAINT "wallet_accounts_version_non_negative" CHECK ("version" >= 0);

-- An account never changes hands and is never deleted.
CREATE OR REPLACE FUNCTION "wallet_accounts_guard"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'wallet_accounts rows are never deleted.';
  END IF;

  IF NEW."owner_type" IS DISTINCT FROM OLD."owner_type"
     OR NEW."owner_id" IS DISTINCT FROM OLD."owner_id"
     OR NEW."currency" IS DISTINCT FROM OLD."currency" THEN
    RAISE EXCEPTION 'wallet_accounts owner and currency are immutable.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "wallet_accounts_owner_immutable"
  BEFORE UPDATE ON "wallet_accounts"
  FOR EACH ROW EXECUTE FUNCTION "wallet_accounts_guard"();

CREATE TRIGGER "wallet_accounts_no_delete"
  BEFORE DELETE ON "wallet_accounts"
  FOR EACH ROW EXECUTE FUNCTION "wallet_accounts_guard"();

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_amount_non_zero" CHECK ("amount" <> 0);

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_balance_after_non_negative"
  CHECK ("balance_after" >= 0);

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_currency_iso4217"
  CHECK ("currency" ~ '^[A-Z]{3}$');

-- Credit types credit, debit types debit; ADJUSTMENT may be either.
ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_sign_matches_type" CHECK (
    ("type" IN ('DEPOSIT', 'BET_PAYOUT', 'BET_REFUND', 'WELCOME_GRANT',
                'OPENING_FLOAT', 'TICKET_SALE', 'CASH_IN') AND "amount" > 0)
    OR ("type" IN ('WITHDRAWAL', 'BET_STAKE', 'TICKET_PAYOUT', 'TICKET_CANCEL',
                   'CASH_OUT') AND "amount" < 0)
    OR "type" = 'ADJUSTMENT'
  );

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_sequence_non_negative" CHECK ("sequence" >= 0);

-- Counter transactions are always attributable to a cashier.
ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_shop_entry_has_actor" CHECK (
    "type" NOT IN ('TICKET_SALE', 'TICKET_PAYOUT', 'TICKET_CANCEL', 'CASH_IN', 'CASH_OUT')
    OR "actor_id" IS NOT NULL
  );

-- The ledger is append-only: corrections are new ADJUSTMENT rows.
CREATE OR REPLACE FUNCTION "wallet_transactions_reject_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'wallet_transactions is append-only: % is not permitted. Record a correcting '
    'ADJUSTMENT entry instead.', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "wallet_transactions_no_update"
  BEFORE UPDATE ON "wallet_transactions"
  FOR EACH ROW EXECUTE FUNCTION "wallet_transactions_reject_mutation"();

CREATE TRIGGER "wallet_transactions_no_delete"
  BEFORE DELETE ON "wallet_transactions"
  FOR EACH ROW EXECUTE FUNCTION "wallet_transactions_reject_mutation"();

CREATE TRIGGER "wallet_transactions_no_truncate"
  BEFORE TRUNCATE ON "wallet_transactions"
  FOR EACH STATEMENT EXECUTE FUNCTION "wallet_transactions_reject_mutation"();
