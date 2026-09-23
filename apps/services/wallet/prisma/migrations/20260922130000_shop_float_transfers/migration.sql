-- CreateTable
CREATE TABLE "shop_float_transfers" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "from_shift_id" UUID NOT NULL,
    "from_cashier_id" UUID NOT NULL,
    "to_shift_id" UUID NOT NULL,
    "to_cashier_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "note" VARCHAR(160) NOT NULL,
    "authorised_by" UUID NOT NULL,
    "idempotency_key" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_float_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shop_float_transfers_idempotency_key_key" ON "shop_float_transfers"("idempotency_key");

-- CreateIndex
CREATE INDEX "shop_float_transfers_shop_id_created_at_idx" ON "shop_float_transfers"("shop_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "shop_float_transfers_from_shift_id_idx" ON "shop_float_transfers"("from_shift_id");

-- CreateIndex
CREATE INDEX "shop_float_transfers_to_shift_id_idx" ON "shop_float_transfers"("to_shift_id");
