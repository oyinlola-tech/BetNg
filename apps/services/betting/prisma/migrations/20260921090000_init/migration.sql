-- The `betting` schema is created by infrastructure/postgres/bootstrap.sql; this login cannot create schemas.

-- CreateEnum
CREATE TYPE "bet_status" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "bet_channel" AS ENUM ('ONLINE', 'SHOP');

-- CreateEnum
CREATE TYPE "selection_outcome" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('OPEN', 'WON', 'LOST', 'VOID', 'CANCELLED', 'PAID', 'EXPIRED');

-- CreateTable
CREATE TABLE "bets" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "channel" "bet_channel" NOT NULL,
    "shop_id" UUID,
    "cashier_id" UUID,
    "stake" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "total_odds" DECIMAL(12,2) NOT NULL,
    "potential_payout" BIGINT NOT NULL,
    "status" "bet_status" NOT NULL DEFAULT 'PENDING',
    "payout" BIGINT,
    "risk_decision_id" UUID,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "placed_at" TIMESTAMPTZ(3) NOT NULL,
    "settled_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet_selections" (
    "id" UUID NOT NULL,
    "bet_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "market_id" UUID NOT NULL,
    "selection_id" UUID NOT NULL,
    "league_id" UUID NOT NULL,
    "market_type" VARCHAR(32) NOT NULL,
    "selection_code" VARCHAR(32) NOT NULL,
    "line" DECIMAL(4,1),
    "odds" DECIMAL(8,2) NOT NULL,
    "odds_version" INTEGER NOT NULL,
    "market_label" VARCHAR(64) NOT NULL,
    "selection_label" VARCHAR(64) NOT NULL,
    "match_label" VARCHAR(160) NOT NULL,
    "league_name" VARCHAR(120) NOT NULL,
    "kickoff_at" TIMESTAMPTZ(3) NOT NULL,
    "outcome" "selection_outcome" NOT NULL DEFAULT 'PENDING',
    "result" VARCHAR(16),

    CONSTRAINT "bet_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "bet_id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "shop_id" UUID NOT NULL,
    "shop_code" VARCHAR(20) NOT NULL,
    "cashier_id" UUID NOT NULL,
    "cashier_name" VARCHAR(60) NOT NULL,
    "customer_name" VARCHAR(80),
    "customer_phone" VARCHAR(20),
    "status" "ticket_status" NOT NULL DEFAULT 'OPEN',
    "paid_at" TIMESTAMPTZ(3),
    "paid_by" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "cancel_reason" VARCHAR(160),
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bets_idempotency_key_key" ON "bets"("idempotency_key");

-- CreateIndex
CREATE INDEX "bets_user_id_placed_at_idx" ON "bets"("user_id", "placed_at" DESC);

-- CreateIndex
CREATE INDEX "bets_status_placed_at_idx" ON "bets"("status", "placed_at");

-- CreateIndex
CREATE INDEX "bets_shop_id_placed_at_idx" ON "bets"("shop_id", "placed_at" DESC);

-- CreateIndex
CREATE INDEX "bet_selections_match_id_outcome_idx" ON "bet_selections"("match_id", "outcome");

-- CreateIndex
CREATE INDEX "bet_selections_selection_id_idx" ON "bet_selections"("selection_id");

-- CreateIndex
CREATE UNIQUE INDEX "bet_selections_bet_id_selection_id_key" ON "bet_selections"("bet_id", "selection_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_bet_id_key" ON "tickets"("bet_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_code_key" ON "tickets"("code");

-- CreateIndex
CREATE INDEX "tickets_shop_id_created_at_idx" ON "tickets"("shop_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "tickets_shop_id_status_idx" ON "tickets"("shop_id", "status");

-- AddForeignKey
ALTER TABLE "bet_selections" ADD CONSTRAINT "bet_selections_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

