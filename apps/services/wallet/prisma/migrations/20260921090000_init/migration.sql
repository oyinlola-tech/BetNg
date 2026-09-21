-- The `wallet` schema is created by infrastructure/postgres/bootstrap.sql; this login may not create schemas.

-- CreateEnum
CREATE TYPE "owner_type" AS ENUM ('CUSTOMER', 'SHOP');

-- CreateEnum
CREATE TYPE "transaction_type" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'BET_STAKE', 'BET_PAYOUT', 'BET_REFUND', 'ADJUSTMENT', 'WELCOME_GRANT', 'OPENING_FLOAT', 'TICKET_SALE', 'TICKET_PAYOUT', 'TICKET_CANCEL', 'CASH_IN', 'CASH_OUT');

-- CreateTable
CREATE TABLE "wallet_accounts" (
    "id" UUID NOT NULL,
    "owner_type" "owner_type" NOT NULL,
    "owner_id" UUID NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "reserved" BIGINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "version" INTEGER NOT NULL DEFAULT 0,
    "frozen_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "wallet_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "type" "transaction_type" NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "idempotency_key" VARCHAR(120) NOT NULL,
    "reference" VARCHAR(120),
    "note" VARCHAR(160),
    "actor_id" VARCHAR(64),
    "corrects_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_accounts_owner_type_owner_id_key" ON "wallet_accounts"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_account_id_created_at_idx" ON "wallet_transactions"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_created_at_idx" ON "wallet_transactions"("created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_reference_idx" ON "wallet_transactions"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_account_id_idempotency_key_key" ON "wallet_transactions"("account_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "wallet_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

