-- CreateEnum
CREATE TYPE "settlement_outcome" AS ENUM ('WON', 'LOST', 'VOID');

-- CreateTable
CREATE TABLE "settlements" (
    "id" UUID NOT NULL,
    "bet_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "outcome" "settlement_outcome" NOT NULL,
    "payout" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "supersedes_id" UUID,
    "settled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settled_selections" (
    "id" UUID NOT NULL,
    "settlement_id" UUID NOT NULL,
    "selection_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "outcome" "settlement_outcome" NOT NULL,

    CONSTRAINT "settled_selections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "settlements_match_id_idx" ON "settlements"("match_id");

-- CreateIndex
CREATE INDEX "settlements_outcome_idx" ON "settlements"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_bet_id_revision_key" ON "settlements"("bet_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "settled_selections_settlement_id_selection_id_key" ON "settled_selections"("settlement_id", "selection_id");

-- AddForeignKey
ALTER TABLE "settled_selections" ADD CONSTRAINT "settled_selections_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
