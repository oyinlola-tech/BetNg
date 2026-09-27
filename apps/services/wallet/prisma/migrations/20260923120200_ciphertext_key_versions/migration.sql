-- The ciphertext checks pinned every row to key version 1, so the first write after a
-- key rotation was refused. They now accept any key version and still refuse plaintext.

ALTER TABLE "bank_accounts" DROP CONSTRAINT "bank_accounts_ciphertext_only";
ALTER TABLE "bank_accounts"
  ADD CONSTRAINT "bank_accounts_ciphertext_only"
  CHECK ("account_number_encrypted" IS NULL OR "account_number_encrypted" ~ '^v[1-9][0-9]*:');

ALTER TABLE "bank_account_verifications" DROP CONSTRAINT "bank_account_verifications_ciphertext_only";
ALTER TABLE "bank_account_verifications"
  ADD CONSTRAINT "bank_account_verifications_ciphertext_only"
  CHECK ("account_number_encrypted" ~ '^v[1-9][0-9]*:');
