-- CreateTable
CREATE TABLE "settlements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bet_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "outcome" TEXT NOT NULL,
    "stake" BIGINT NOT NULL,
    "payout" BIGINT NOT NULL,
    "channel" TEXT NOT NULL,
    "user_id" UUID,
    "shop_id" UUID,
    "cashier_id" UUID,
    "period_id" TEXT NOT NULL,
    "effects_applied_at" TIMESTAMPTZ(3),
    "settled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settled_selections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "settlement_id" UUID NOT NULL,
    "selection_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "outcome" TEXT NOT NULL,
    "result" TEXT,

    CONSTRAINT "settled_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_settlements" (
    "match_id" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'RESULT',
    "status" TEXT NOT NULL,
    "bets_total" INTEGER NOT NULL DEFAULT 0,
    "bets_settled" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "match_settlements_pkey" PRIMARY KEY ("match_id")
);

-- CreateTable
CREATE TABLE "operator_periods" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3),

    CONSTRAINT "operator_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_ledger_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "settlement_id" UUID NOT NULL,
    "period_id" TEXT NOT NULL,
    "bet_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "user_id" UUID,
    "shop_id" UUID,
    "cashier_id" UUID,
    "outcome" TEXT NOT NULL,
    "stake" BIGINT NOT NULL,
    "payout" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operator_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_ledger" (
    "period_id" TEXT NOT NULL,
    "gross_stakes" BIGINT NOT NULL,
    "gross_payouts" BIGINT NOT NULL,
    "operator_result" BIGINT NOT NULL,
    "operator_result_rate" DECIMAL(9,6) NOT NULL,
    "settled_bets" INTEGER NOT NULL,
    "void_bets" INTEGER NOT NULL,
    "refunded_stakes" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operator_ledger_pkey" PRIMARY KEY ("period_id")
);

-- CreateTable
CREATE TABLE "commission_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shop_id" UUID,
    "shop_share_percent" DECIMAL(5,2) NOT NULL,
    "effective_from" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "commission_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_ledger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "period_id" TEXT NOT NULL,
    "shop_id" UUID NOT NULL,
    "gross_stakes" BIGINT NOT NULL,
    "gross_payouts" BIGINT NOT NULL,
    "gross_operator_result" BIGINT NOT NULL,
    "shop_share_percent" DECIMAL(5,2) NOT NULL,
    "shop_share_amount" BIGINT NOT NULL,
    "platform_share_percent" DECIMAL(5,2) NOT NULL,
    "platform_share_amount" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "settlements_user_id_settled_at_idx" ON "settlements"("user_id", "settled_at");

-- CreateIndex
CREATE INDEX "settlements_period_id_idx" ON "settlements"("period_id");

-- CreateIndex
CREATE INDEX "settlements_settled_at_idx" ON "settlements"("settled_at");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_bet_id_revision_key" ON "settlements"("bet_id", "revision");

-- CreateIndex
CREATE INDEX "settled_selections_match_id_idx" ON "settled_selections"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "settled_selections_settlement_id_selection_id_key" ON "settled_selections"("settlement_id", "selection_id");

-- CreateIndex
CREATE INDEX "match_settlements_status_idx" ON "match_settlements"("status");

-- CreateIndex
CREATE INDEX "operator_periods_status_idx" ON "operator_periods"("status");

-- CreateIndex
CREATE UNIQUE INDEX "operator_ledger_entries_settlement_id_key" ON "operator_ledger_entries"("settlement_id");

-- CreateIndex
CREATE INDEX "operator_ledger_entries_period_id_shop_id_idx" ON "operator_ledger_entries"("period_id", "shop_id");

-- CreateIndex
CREATE INDEX "commission_config_shop_id_effective_from_idx" ON "commission_config"("shop_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "commission_ledger_period_id_shop_id_key" ON "commission_ledger"("period_id", "shop_id");

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "operator_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settled_selections" ADD CONSTRAINT "settled_selections_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_ledger_entries" ADD CONSTRAINT "operator_ledger_entries_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_ledger_entries" ADD CONSTRAINT "operator_ledger_entries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "operator_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_ledger" ADD CONSTRAINT "operator_ledger_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "operator_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "operator_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

