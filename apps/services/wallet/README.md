# wallet service

Customer wallets, shop floats and the append-only ledger, plus payments (deposits, withdrawals, provider webhooks), bank accounts, statements and cashier shifts. Port 3003, schema `wallet`.

## The ledger

`wallet_transactions` is append-only (triggers reject UPDATE/DELETE/TRUNCATE) and `wallet_accounts.balance` is its projection. The only code that changes a balance is `postWithinTransaction` (`src/repositories/ledger.ts`): it locks the account row, checks the per-account idempotency key, the available balance (`balance − reserved`) and the frozen flag, inserts the entry and updates the balance. Payment code calls it inside the same transaction as the payment's status change, so neither commits without the other.

| Event | Ledger entry | Idempotency key |
| --- | --- | --- |
| Deposit confirmed by the provider | `DEPOSIT` +amount | `deposit:<paymentId>` |
| Withdrawal requested | `WITHDRAWAL` −amount | `withdrawal:<paymentId>` |
| Transfer failed / reversed, or review rejected | `WITHDRAWAL_REVERSAL` +amount | `withdrawal-reversal:<paymentId>` |
| Shift cash in / out | `CASH_IN` / `CASH_OUT` on the shop float, `actor_id` = cashier | `cash:<shiftId>:<client key>` |

Withdrawals are held by debiting at request time rather than through `reserved`: `reserved` means stakes on open bets, and the ledger records only what happened. While the provider has the transfer, the amount is reported as `pending` on `GET /wallets/:userId`.

## Payments

`payments` holds one row per deposit or withdrawal (the columns identity reads are in `docs/backend-interfaces.md`). Status moves forward only; the `payments_guard` trigger enforces the same table as `PAYMENT_TRANSITIONS`:

```
INITIATED → PENDING | PROCESSING | CONFIRMED | FAILED | CANCELLED | EXPIRED
PENDING   → PROCESSING | CONFIRMED | FAILED | CANCELLED | EXPIRED
PROCESSING→ CONFIRMED | FAILED | CANCELLED | EXPIRED
CONFIRMED → REVERSED
```

Deposits: `initiate` (idempotency key required; `limits.check` DEPOSIT, then the `kyc.status` daily deposit allowance; both fail closed with 503) creates the provider transaction and returns an https `checkoutUrl` or instructions. The callback is `PAYMENTS_CALLBACK_BASE_URL` + a validated `returnPath` on that origin. Only the provider's answer credits: `verify`, a verified webhook, or the expiry job re-query the provider, and the payment row lock plus the ledger key make a concurrent verify and webhook credit once. An amount or currency that differs from the row flags the payment (`flagged_at`, kept in `PROCESSING`) and nothing is credited; a success reported after a payment closed is flagged too. Stale `INITIATED`/`PENDING` deposits are re-verified by the job and expired only if the provider has no payment.

Withdrawals: `quote` and `request` apply the platform fee (`WITHDRAWAL_FEE_KOBO`, or `WITHDRAWAL_FEE_HIGH_KOBO` from `WITHDRAWAL_FEE_HIGH_FROM_KOBO`); `request` needs the caller's saved bank account, `limits.check` WITHDRAWAL and the KYC daily withdrawal allowance (or `VERIFIED` status when identity gives no allowance). Amounts above `WITHDRAWAL_REVIEW_THRESHOLD_KOBO` wait for `POST /admin/payments/withdrawals/:reference/review` (`payments:write`, reason required, audited through `identity.recordAudit` before anything changes). The transfer reference is the payment reference, so a retried dispatch first asks the provider whether the earlier attempt landed.

Webhooks (`POST /payments/webhook/{paystack,flutterwave,bachs}`) are verified over the raw request bytes before parsing: Paystack HMAC-SHA512 of the body with the secret key against `x-paystack-signature`, Flutterwave `verif-hash` against `FLUTTERWAVE_WEBHOOK_HASH`, both constant-time. The event id is recorded in `payment_webhook_events` (no payload is stored) and a repeat answers 200 `duplicate`. The provider is then re-queried; the webhook body alone never credits. An event that fails to process is left unprocessed and answered 503 so the provider retries.

### Providers

| `PAYMENTS_PROVIDER` | Adapter |
| --- | --- |
| `paystack` | `transaction/initialize`, `transaction/verify`, `bank`, `bank/resolve`, `transferrecipient`, `transfer`, `transfer/verify` |
| `flutterwave` | v3 `payments`, `transactions/verify_by_reference`, `banks/NG`, `accounts/resolve`, `transfers`, `transfers/:id` (amounts converted exactly between kobo and naira) |
| `bachs` | No API specification exists in the repository, so the adapter is `configuration required`: every call answers `PAYMENT_PROVIDER_UNAVAILABLE` and webhooks are refused. Production refuses to start with it selected. |
| `sandbox` | Development/test only (refused in production). Instructions instead of a checkout; the first status check reports `PROCESSING`, the next settles. Amounts ending in 13 kobo fail and 17 expire; account numbers starting `000` fail name enquiry — the same rules as the frontend stand-in. |
| `none` | Payments off; every payment route answers `PAYMENT_PROVIDER_UNAVAILABLE`. |

Every provider call has `PAYMENTS_PROVIDER_TIMEOUT_MS`. Unreachable, timed-out, 5xx and 429 answers map to `PAYMENT_PROVIDER_UNAVAILABLE` (503); a 4xx refusal to `PAYMENT_FAILED` (422). Provider messages are never returned or logged.

## Bank accounts

Name enquiry goes through the active provider (20 per customer per hour). The full account number is stored only as AES-256-GCM ciphertext (`WALLET_ENCRYPTION_KEY`, owner id as associated data) with the last four digits and an HMAC lookup hash for duplicate detection; `bank_accounts` and `bank_account_verifications` are revoked from `betng_reader`. An account is saved from its `verificationId` (10 minutes, single use, the caller's own); the client never supplies the name. Lists show `******1234`. Deleting clears the ciphertext and is refused while a withdrawal to the account is in flight.

## Statements

`POST /account/statements` creates a `statement_jobs` row; ranges up to 31 days are generated before the response, longer ones (up to 366 days) by the job. The file is CSV (formula cells defused) or a hand-written PDF 1.4, uploaded to S3-compatible storage with SigV4 (`WALLET_STORAGE_*`). `GET /account/statements/:id` returns a fresh presigned https link valid for 5 minutes; files older than 24 hours report `EXPIRED` (set an object lifecycle rule on the bucket to delete them). Without storage configured the job ends `FAILED` with no link.

## Cashier shifts

`POST /shop/shifts` (`shifts:operate`, idempotency key) opens a shift; a partial unique index allows one `OPEN`/`CLOSING` shift per cashier. `POST /shop/shifts/current/cash` (`cash:move`) posts `CASH_IN`/`CASH_OUT` to the shop float. `POST /shop/shifts/:id/close` totals the counted denominations (NGN notes only), verifies the PIN through `identity.verifyCashierPin` (fail closed), computes expected cash from the ledger for the shift window — opening float + ticket sales − payouts − cancellations + cash in − cash out, from the cashier's own entries — and stores discrepancy = counted − expected. `GET /shop/shifts?date=` lists the caller's shifts, or every shop shift with `reports:read`.

## Admin

`GET /admin/payments/overview` and `GET /admin/payments` (`payments:read`; filters `direction`, `status`, `provider`, `from`, `to`, `search` on reference or email). Provider health comes from the outcome of recent calls, with a light probe when there has been none for 10 minutes.

## Peers

- identity RPC: `limits.check`, `kyc.status`, `identity.verifyCashierPin`, `identity.recordAudit`, `identity.notify` (best effort, kind `PAYMENT_UPDATED`).
- event RPC: `event.publishSignal` `WALLET_UPDATED` on `wallet:{userId}` and `shop:{shopId}` (best effort).

## Configuration

See the wallet block in the root `.env.example`. Secrets are read once, validated and wrapped so they never print. Production refuses to start with the sandbox or Bachs selected, a test key, a missing encryption key, a non-https callback or provider URL, partial storage settings, the play-money routes on, or a welcome grant above 0.

## Commands

```
pnpm --filter @betng/wallet-service db:migrate      # apply migrations
pnpm --filter @betng/wallet-service db:generate     # regenerate the Prisma client
./node_modules/.bin/tsc -p apps/services/wallet/tsconfig.json --noEmit
pnpm exec vitest run --project unit apps/services/wallet   # needs the betng_test_wallet database
```
