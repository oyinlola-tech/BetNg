-- CreateEnum
CREATE TYPE "bet_status" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID');

-- CreateTable
CREATE TABLE "bets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "stake" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "total_odds" DECIMAL(12,4) NOT NULL,
    "potential_payout" BIGINT NOT NULL,
    "status" "bet_status" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" VARCHAR(120) NOT NULL,
    "risk_action" VARCHAR(32),
    "risk_assessed" BOOLEAN NOT NULL DEFAULT false,
    "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet_selections" (
    "id" UUID NOT NULL,
    "bet_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "market_id" UUID NOT NULL,
    "selection_id" UUID NOT NULL,
    "odds" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "bet_selections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bets_idempotency_key_key" ON "bets"("idempotency_key");

-- CreateIndex
CREATE INDEX "bets_user_id_status_idx" ON "bets"("user_id", "status");

-- CreateIndex
CREATE INDEX "bets_status_placed_at_idx" ON "bets"("status", "placed_at");

-- CreateIndex
CREATE INDEX "bet_selections_match_id_idx" ON "bet_selections"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "bet_selections_bet_id_selection_id_key" ON "bet_selections"("bet_id", "selection_id");

-- AddForeignKey
ALTER TABLE "bet_selections" ADD CONSTRAINT "bet_selections_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
