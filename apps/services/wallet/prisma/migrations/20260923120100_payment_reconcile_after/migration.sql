-- Backs off a payment the provider has not finished with, so it cannot hold the head
-- of the reconciliation queue.

ALTER TABLE "payments" ADD COLUMN "reconcile_after" timestamptz(3);
