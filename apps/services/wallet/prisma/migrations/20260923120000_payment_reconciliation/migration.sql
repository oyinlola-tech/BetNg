-- When the provider last agreed with a closed payment. A closed payment the provider
-- disagrees with is flagged instead, so it reaches an operator rather than standing.

ALTER TABLE "payments" ADD COLUMN "reconciled_at" timestamptz(3);

-- Only the closed, unflagged, unreconciled rows the reconciliation job scans.
CREATE INDEX "payments_reconciliation_due_idx"
  ON "payments" ("updated_at")
  WHERE "reconciled_at" IS NULL AND "flagged_at" IS NULL
    AND "status" IN ('CONFIRMED', 'FAILED', 'EXPIRED', 'REVERSED', 'CANCELLED');
