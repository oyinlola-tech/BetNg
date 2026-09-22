-- A stake that moved for a bet that was never written. Rows are drained by the stake-return job until the
-- wallet confirms the return; the wallet dedupes on idempotency_key, so a retried return moves money once.

CREATE TABLE "stake_returns" (
    "bet_id" UUID NOT NULL,
    "direction" VARCHAR(8) NOT NULL,
    "owner_type" VARCHAR(16) NOT NULL,
    "owner_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "movement_type" VARCHAR(32) NOT NULL,
    "reference" VARCHAR(64),
    "actor_id" UUID,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "request_id" VARCHAR(200) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(240),
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),
    "resolution" VARCHAR(16),

    CONSTRAINT "stake_returns_pkey" PRIMARY KEY ("bet_id")
);

CREATE UNIQUE INDEX "stake_returns_idempotency_key_key" ON "stake_returns"("idempotency_key");

CREATE INDEX "stake_returns_due_idx" ON "stake_returns"("next_attempt_at") WHERE "resolved_at" IS NULL;

ALTER TABLE "stake_returns"
  ADD CONSTRAINT "stake_returns_direction_known" CHECK ("direction" IN ('debit', 'credit')),
  ADD CONSTRAINT "stake_returns_owner_known" CHECK ("owner_type" IN ('CUSTOMER', 'SHOP')),
  ADD CONSTRAINT "stake_returns_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "stake_returns_attempts_non_negative" CHECK ("attempts" >= 0),
  ADD CONSTRAINT "stake_returns_resolution_known" CHECK (
    ("resolved_at" IS NULL AND "resolution" IS NULL)
    OR ("resolved_at" IS NOT NULL AND "resolution" IN ('RETURNED', 'BET_EXISTS'))
  );
