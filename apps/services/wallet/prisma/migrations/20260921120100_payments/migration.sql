-- Payments, bank accounts, provider webhooks, statements and cashier shifts. Status columns are text with CHECKs so
-- other services read them as text (docs/architecture.md §8).

ALTER TABLE "wallet_transactions" DROP CONSTRAINT "wallet_transactions_sign_matches_type";
ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_sign_matches_type" CHECK (
    ("type" IN ('DEPOSIT', 'BET_PAYOUT', 'BET_REFUND', 'WELCOME_GRANT',
                'OPENING_FLOAT', 'TICKET_SALE', 'CASH_IN', 'WITHDRAWAL_REVERSAL') AND "amount" > 0)
    OR ("type" IN ('WITHDRAWAL', 'BET_STAKE', 'TICKET_PAYOUT', 'TICKET_CANCEL',
                   'CASH_OUT') AND "amount" < 0)
    OR "type" = 'ADJUSTMENT'
  );

CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "bank_code" VARCHAR(10) NOT NULL,
    "bank_name" VARCHAR(80) NOT NULL,
    "account_number_encrypted" TEXT,
    "account_number_hash" CHAR(64) NOT NULL,
    "last4" CHAR(4) NOT NULL,
    "account_name" VARCHAR(120) NOT NULL,
    "recipient_code" VARCHAR(120),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bank_accounts_last4_digits" CHECK ("last4" ~ '^[0-9]{4}$'),
    CONSTRAINT "bank_accounts_live_has_number" CHECK ("deleted_at" IS NOT NULL OR "account_number_encrypted" IS NOT NULL),
    CONSTRAINT "bank_accounts_ciphertext_only" CHECK ("account_number_encrypted" IS NULL OR "account_number_encrypted" LIKE 'v1:%')
);

CREATE INDEX "bank_accounts_user_id_idx" ON "bank_accounts"("user_id", "created_at");
CREATE UNIQUE INDEX "bank_accounts_one_live_per_number" ON "bank_accounts"("user_id", "account_number_hash", "bank_code") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "bank_accounts_one_default" ON "bank_accounts"("user_id") WHERE "is_default" AND "deleted_at" IS NULL;

CREATE TABLE "bank_account_verifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "bank_code" VARCHAR(10) NOT NULL,
    "bank_name" VARCHAR(80) NOT NULL,
    "account_number_encrypted" TEXT NOT NULL,
    "account_number_hash" CHAR(64) NOT NULL,
    "last4" CHAR(4) NOT NULL,
    "account_name" VARCHAR(120) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_account_verifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bank_account_verifications_ciphertext_only" CHECK ("account_number_encrypted" LIKE 'v1:%')
);

CREATE INDEX "bank_account_verifications_user_id_idx" ON "bank_account_verifications"("user_id", "created_at");

CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "fee" BIGINT NOT NULL DEFAULT 0,
    "net_amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "method" TEXT,
    "provider" TEXT NOT NULL,
    "provider_reference" VARCHAR(120),
    "provider_event_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "checkout_url" TEXT,
    "instructions" JSONB,
    "expires_at" TIMESTAMPTZ(3),
    "idempotency_key" VARCHAR(120) NOT NULL,
    "bank_account_id" UUID,
    "failure_reason" VARCHAR(200),
    "error_code" VARCHAR(60),
    "review_status" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "reviewed_by" VARCHAR(64),
    "reviewed_at" TIMESTAMPTZ(3),
    "review_reason" VARCHAR(300),
    "flagged_at" TIMESTAMPTZ(3),
    "flag_reason" VARCHAR(200),
    "provider_checks" INTEGER NOT NULL DEFAULT 0,
    "transfer_requested_at" TIMESTAMPTZ(3),
    "ledger_entry_id" UUID,
    "reversal_entry_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payments_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT,
    CONSTRAINT "payments_direction_allowed" CHECK ("direction" IN ('DEPOSIT', 'WITHDRAWAL')),
    CONSTRAINT "payments_status_allowed" CHECK ("status" IN ('INITIATED', 'PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REVERSED')),
    CONSTRAINT "payments_method_allowed" CHECK ("method" IS NULL OR "method" IN ('CARD', 'BANK_TRANSFER', 'USSD')),
    CONSTRAINT "payments_provider_allowed" CHECK ("provider" IN ('PAYSTACK', 'FLUTTERWAVE', 'BACHS', 'SANDBOX')),
    CONSTRAINT "payments_review_allowed" CHECK ("review_status" IN ('NOT_REQUIRED', 'REQUIRED', 'APPROVED', 'REJECTED')),
    CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0 AND "amount" <= 9007199254740991),
    CONSTRAINT "payments_fee_non_negative" CHECK ("fee" >= 0),
    CONSTRAINT "payments_net_is_amount_less_fee" CHECK ("net_amount" = "amount" - "fee" AND "net_amount" >= 0),
    CONSTRAINT "payments_currency_iso4217" CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "payments_withdrawal_has_account" CHECK ("direction" = 'DEPOSIT' OR "bank_account_id" IS NOT NULL),
    CONSTRAINT "payments_checkout_https" CHECK ("checkout_url" IS NULL OR "checkout_url" LIKE 'https://%'),
    CONSTRAINT "payments_confirmed_deposit_credited" CHECK (
      "direction" <> 'DEPOSIT' OR "status" NOT IN ('CONFIRMED', 'REVERSED') OR "ledger_entry_id" IS NOT NULL)
);

CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");
CREATE UNIQUE INDEX "payments_user_id_idempotency_key_key" ON "payments"("user_id", "idempotency_key");
CREATE INDEX "payments_user_id_created_at_idx" ON "payments"("user_id", "created_at");
CREATE INDEX "payments_status_direction_idx" ON "payments"("status", "direction");
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");
CREATE INDEX "payments_provider_reference_idx" ON "payments"("provider", "provider_reference");
CREATE INDEX "payments_bank_account_id_idx" ON "payments"("bank_account_id");

-- Status moves only forward, as the service's transition table allows; identity and amounts never change.
CREATE OR REPLACE FUNCTION "payments_guard"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'payments rows are never deleted.';
  END IF;

  IF NEW."reference" IS DISTINCT FROM OLD."reference"
     OR NEW."user_id" IS DISTINCT FROM OLD."user_id"
     OR NEW."direction" IS DISTINCT FROM OLD."direction"
     OR NEW."amount" IS DISTINCT FROM OLD."amount"
     OR NEW."fee" IS DISTINCT FROM OLD."fee"
     OR NEW."currency" IS DISTINCT FROM OLD."currency"
     OR NEW."provider" IS DISTINCT FROM OLD."provider"
     OR NEW."idempotency_key" IS DISTINCT FROM OLD."idempotency_key"
     OR NEW."bank_account_id" IS DISTINCT FROM OLD."bank_account_id" THEN
    RAISE EXCEPTION 'payments identity and amounts are immutable.';
  END IF;

  IF OLD."ledger_entry_id" IS NOT NULL AND NEW."ledger_entry_id" IS DISTINCT FROM OLD."ledger_entry_id" THEN
    RAISE EXCEPTION 'payments ledger_entry_id is set once.';
  END IF;

  IF OLD."reversal_entry_id" IS NOT NULL AND NEW."reversal_entry_id" IS DISTINCT FROM OLD."reversal_entry_id" THEN
    RAISE EXCEPTION 'payments reversal_entry_id is set once.';
  END IF;

  IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
       (OLD."status" = 'INITIATED' AND NEW."status" IN ('PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED', 'CANCELLED', 'EXPIRED'))
    OR (OLD."status" = 'PENDING' AND NEW."status" IN ('PROCESSING', 'CONFIRMED', 'FAILED', 'CANCELLED', 'EXPIRED'))
    OR (OLD."status" = 'PROCESSING' AND NEW."status" IN ('CONFIRMED', 'FAILED', 'CANCELLED', 'EXPIRED'))
    OR (OLD."status" = 'CONFIRMED' AND NEW."status" = 'REVERSED')
  ) THEN
    RAISE EXCEPTION 'payments status cannot move from % to %.', OLD."status", NEW."status";
  END IF;

  NEW."updated_at" := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payments_guard_update"
  BEFORE UPDATE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION "payments_guard"();

CREATE TRIGGER "payments_guard_delete"
  BEFORE DELETE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION "payments_guard"();

CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "event_id" VARCHAR(200) NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "payment_reference" VARCHAR(120),
    "outcome" VARCHAR(40),
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_webhook_events_provider_event_id_key" ON "payment_webhook_events"("provider", "event_id");

CREATE TABLE "statement_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "format" TEXT NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "storage_key" VARCHAR(300),
    "failure_reason" VARCHAR(200),
    "claimed_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ready_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "statement_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "statement_jobs_format_allowed" CHECK ("format" IN ('PDF', 'CSV')),
    CONSTRAINT "statement_jobs_status_allowed" CHECK ("status" IN ('QUEUED', 'READY', 'FAILED', 'EXPIRED')),
    CONSTRAINT "statement_jobs_range" CHECK ("from_date" <= "to_date"),
    CONSTRAINT "statement_jobs_ready_has_file" CHECK ("status" <> 'READY' OR "storage_key" IS NOT NULL)
);

CREATE INDEX "statement_jobs_user_id_idx" ON "statement_jobs"("user_id", "created_at");
CREATE INDEX "statement_jobs_status_idx" ON "statement_jobs"("status", "created_at");

CREATE TABLE "cashier_shifts" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "cashier_id" UUID NOT NULL,
    "cashier_name" VARCHAR(60) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "opening_float" BIGINT NOT NULL,
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(3),
    "totals" JSONB,
    "counted" JSONB,
    "counted_cash" BIGINT,
    "expected_cash" BIGINT,
    "discrepancy" BIGINT,
    "discrepancy_note" VARCHAR(300),
    "open_idempotency_key" VARCHAR(120) NOT NULL,
    "close_idempotency_key" VARCHAR(120),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cashier_shifts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cashier_shifts_status_allowed" CHECK ("status" IN ('OPEN', 'CLOSING', 'CLOSED', 'RECONCILED')),
    CONSTRAINT "cashier_shifts_opening_float_non_negative" CHECK ("opening_float" >= 0),
    CONSTRAINT "cashier_shifts_counted_non_negative" CHECK ("counted_cash" IS NULL OR "counted_cash" >= 0),
    CONSTRAINT "cashier_shifts_discrepancy_consistent" CHECK (
      "discrepancy" IS NULL OR "discrepancy" = "counted_cash" - "expected_cash"),
    CONSTRAINT "cashier_shifts_closed_complete" CHECK (
      "status" IN ('OPEN', 'CLOSING')
      OR ("closed_at" IS NOT NULL AND "counted_cash" IS NOT NULL AND "expected_cash" IS NOT NULL AND "totals" IS NOT NULL))
);

CREATE UNIQUE INDEX "cashier_shifts_one_open" ON "cashier_shifts"("cashier_id") WHERE "status" IN ('OPEN', 'CLOSING');
CREATE UNIQUE INDEX "cashier_shifts_open_key" ON "cashier_shifts"("cashier_id", "open_idempotency_key");
CREATE INDEX "cashier_shifts_shop_opened_idx" ON "cashier_shifts"("shop_id", "opened_at");

CREATE OR REPLACE FUNCTION "cashier_shifts_guard"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'cashier_shifts rows are never deleted.';
  END IF;

  IF OLD."status" IN ('CLOSED', 'RECONCILED') AND NOT (OLD."status" = 'CLOSED' AND NEW."status" = 'RECONCILED') THEN
    RAISE EXCEPTION 'A closed shift is final.';
  END IF;

  IF NEW."shop_id" IS DISTINCT FROM OLD."shop_id"
     OR NEW."cashier_id" IS DISTINCT FROM OLD."cashier_id"
     OR NEW."opening_float" IS DISTINCT FROM OLD."opening_float"
     OR NEW."opened_at" IS DISTINCT FROM OLD."opened_at" THEN
    RAISE EXCEPTION 'cashier_shifts owner, opening float and opening time are immutable.';
  END IF;

  NEW."updated_at" := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cashier_shifts_guard_update"
  BEFORE UPDATE ON "cashier_shifts"
  FOR EACH ROW EXECUTE FUNCTION "cashier_shifts_guard"();

CREATE TRIGGER "cashier_shifts_guard_delete"
  BEFORE DELETE ON "cashier_shifts"
  FOR EACH ROW EXECUTE FUNCTION "cashier_shifts_guard"();

-- Ciphertext is still personal data: other services do not need it, so the cross-service reader does not get it.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'betng_reader') THEN
    REVOKE ALL ON "bank_accounts", "bank_account_verifications" FROM betng_reader;
  END IF;
END
$$;
