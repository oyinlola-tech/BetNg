-- Invariants the wallet must never violate, enforced by the database.
--
-- Application code already checks these. The database enforces them too,
-- because a check in one service's code protects only against that code
-- being wrong — not against a migration, a maintenance script or a future
-- caller. For money, the last line of defence belongs where the data lives.

-- A balance can never go below zero: there is no overdraft.
ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_balance_non_negative" CHECK ("balance" >= 0);

-- Reserved funds are a subset of the balance, never more than it.
ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_reserved_non_negative" CHECK ("reserved" >= 0);
ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_reserved_within_balance"
  CHECK ("reserved" <= "balance");

-- ISO 4217 is three uppercase letters. Anything else is a bug that would
-- otherwise surface as money silently held in a currency nothing recognises.
ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_currency_iso4217" CHECK ("currency" ~ '^[A-Z]{3}$');

-- A zero-amount ledger entry records nothing and would make the ledger
-- harder to audit, not easier.
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_amount_non_zero" CHECK ("amount" <> 0);

-- The running balance recorded on an entry is itself a balance.
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_balance_after_non_negative"
  CHECK ("balance_after" >= 0);

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_currency_iso4217"
  CHECK ("currency" ~ '^[A-Z]{3}$');

-- A credit type must credit and a debit type must debit. Without this, a
-- sign error turns a payout into a charge and the type column stops meaning
-- anything. ADJUSTMENT is exempt: correcting an entry requires either sign.
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_sign_matches_type" CHECK (
    ("type" IN ('DEPOSIT', 'BET_PAYOUT', 'BET_REFUND') AND "amount" > 0)
    OR ("type" IN ('WITHDRAWAL', 'BET_STAKE') AND "amount" < 0)
    OR "type" = 'ADJUSTMENT'
  );

-- The ledger is append-only. A row may be inserted and then never changed,
-- so a balance can always be re-derived from history and an audit cannot be
-- quietly rewritten. Corrections are new ADJUSTMENT rows.
CREATE OR REPLACE FUNCTION "transactions_reject_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'transactions is append-only: % is not permitted. Record a correcting '
    'ADJUSTMENT entry instead.', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "transactions_no_update"
  BEFORE UPDATE ON "transactions"
  FOR EACH ROW EXECUTE FUNCTION "transactions_reject_mutation"();

CREATE TRIGGER "transactions_no_delete"
  BEFORE DELETE ON "transactions"
  FOR EACH ROW EXECUTE FUNCTION "transactions_reject_mutation"();
