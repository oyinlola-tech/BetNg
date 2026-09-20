-- CreateEnum
CREATE TYPE "transaction_type" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'BET_STAKE', 'BET_PAYOUT', 'BET_REFUND', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "reserved" BIGINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "version" INTEGER NOT NULL DEFAULT 0,
    "frozen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "type" "transaction_type" NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "idempotency_key" VARCHAR(120) NOT NULL,
    "reference" VARCHAR(120),
    "corrects_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "transactions_wallet_id_created_at_idx" ON "transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_reference_idx" ON "transactions"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_wallet_id_idempotency_key_key" ON "transactions"("wallet_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
