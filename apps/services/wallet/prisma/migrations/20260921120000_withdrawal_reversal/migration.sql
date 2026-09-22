-- A failed, rejected or reversed withdrawal returns its debit with this credit. Kept apart from the CHECK that uses it,
-- because a new enum value cannot be referenced in the transaction that adds it.
ALTER TYPE "transaction_type" ADD VALUE IF NOT EXISTS 'WITHDRAWAL_REVERSAL';
