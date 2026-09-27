# BetNg — Real-Life Production Analysis

Scanned: 2026-09-23. This file consolidates every finding: what is needed to run this as a real-money project, the bugs, the gaps, the security issues, the API list, the frontend improvements, and every mock/sandbox that must be replaced with real data.

## 1. Executive summary

This is a play-money simulation of a virtual football platform. It is well-engineered — 2,577 tests, a 22-step e2e scenario, five frontends, eleven services, one PostgreSQL schema per service, integer-kobo money, HMAC-seeded results, in-running odds recalculation, encryption at rest for KYC documents and bank accounts, a webhook dead-letter queue, RPC rate limiting, breach-checked passwords, mandatory admin TOTP. It is NOT a gambling platform yet.

To make it real you need procurement and compliance before you need code. The technical critical path is short. What follows separates "code we must write" from "things we must buy or license".
## 2. Bugs found in the current tree

### 2.1 HIGH — `apps/services/match` scheduler never re-prices on price-moving events (wired but not triggered)
**Status (2026-09-23):** Already fixed before this scan: `lifecycle.service.ts` calls `odds.recalculate` from the reveal loop.

File: `apps/services/match/src/...` scheduler loop.
The odds recalculation handler exists and is correct, but nothing in the match service calls it. During live
play odds stay static, which is exploitable by anyone watching faster than the market moves. Fix: call
`odds.recalculateOdds(matchId, state)` from the reveal loop after GOAL / RED_CARD / HALF_TIME /
SECOND_HALF events, once per batch, with the state the batch ended on.

### 2.2 HIGH — Simulation service fails to import on `main`
**Status (2026-09-23):** Already fixed before this scan: the three DTOs are re-exported and the service starts.

`controllers/simulation_controller.py` imports `BatchRunMatchBody`, `BatchRunMatchRequest`,
`BatchRunMatchResponse` from `dtos/__init__.py` and those are not re-exported. `import
betng_simulation` raises ImportError; the service never starts and its whole test suite fails to collect.
Fix: add the three names to `dtos/__init__.py`.

### 2.3 HIGH — `RecalculateOddsRequest` handler used the wrong cache key
**Status (2026-09-23):** Already fixed before this scan: the live state is part of the request and the cache key.

The handler asked `simulation.calculateProbabilities(matchId, home, away)` and the simulation cached on
exactly that key, so a recalculation after a goal returned the identical pre-match distribution. The
`state` parameter now exists but only if the caller passes it. Verify the odds service passes the live
state through on every recalculation.

### 2.4 HIGH — `odds_snapshots.reason` CHECK constraint rejected in-running reasons
**Status (2026-09-23):** Already fixed before this scan: `002_in_running_snapshots.sql` widens the constraint.

`CHECK (reason IN ('INITIAL','ADMIN_REPRICE','STATUS_CHANGE'))` while `_snapshot_reason` returns
GOAL / RED_CARD / HALF_TIME / SECOND_HALF. Any recalculation would have failed on a constraint
violation. Migration `002_in_running_snapshots.sql` widens it — confirm it is applied and that the
constraint is `INITIAL | ADMIN_REPRICE | STATUS_CHANGE | GOAL | RED_CARD | HALF_TIME | SECOND_HALF`.

### 2.5 MEDIUM — Settlement realtime publication is fire-and-forget
**Status (2026-09-23):** Fixed. `withBetSignals` retries a failed publish after 250 ms, 1 s and 4 s (±20% jitter), off the settlement path, and warns only once every attempt has failed. `idle()` drains pending retries on shutdown. No outbox: the signal is a re-read prompt and the 60-second backstop stays.

`settlement/src/clients/bet.signals.ts` publishes `BET_SETTLED` and logs a failure; nothing retries. A
dropped signal leaves a stale account view until the 60-second REST re-read in
`packages/ui-core/src/adapters/platformDataSource.ts`. Fix: make settlement publish to the event service
with a dead-letter and retry, or make the event service pull on a timer.

### 2.6 MEDIUM — Risk engine has no caching
**Status (2026-09-23):** Not changed, deliberately. Caching exposure or limits lets a burst of stakes pass against a stale book, which is the failure the risk engine exists to stop. Revisit with load measurements.

`evaluate_stake_handler.py` loads limits, selection states and the book on every evaluation. Deliberate
correctness choice, but under load this is the hottest path in the platform. Add a short-TTL cache keyed
by `(matchId, selectionId)` and invalidate on `BET_ACCEPTED` / `ODDS_UPDATED`.

### 2.7 MEDIUM — Re-encryption pass for key rotation does not exist
**Status (2026-09-23):** Fixed. `apps/services/wallet/src/security/rekey.ts` moves bank accounts, verifications and dead-letter webhook bodies onto the active key and re-hashes `lookupHash` in the same compare-and-set write. The wallet job runs it while `WALLET_ENCRYPTION_KEYS_RETIRED` is set and logs `wallet_rekey_complete` when the retired keys can be dropped. Rows no configured key opens are reported, not touched. See also §2.13.

The key ring makes rotation possible; nothing walks existing rows, decrypts under the retired key and
rewrites under the active one, re-hashing `lookupHash` in the same pass. Until it exists a rotation leaves
old rows on the old key indefinitely. Fix: write `scripts/rotate-encryption-keys.sql` (or a migration)
that does the walk, and document that `lookupHash` must be re-hashed in the same pass.

### 2.8 MEDIUM — Service test databases never reset
**Status (2026-09-23):** Not changed. The two known rotting assertions were already scoped to their run; truncating a database that several test files share would break them. The guidance is in `REAL_LIFE_READINESS.md` §4.5.

`apps/services/match`, `apps/services/identity`, `apps/services/wallet` share one test database across
test files and nothing resets it between runs. Assertions that search globally or assert absolute counts
pass while the table is small and then fail forever. Fix: truncate or use a unique tag per test file in a
`beforeAll`/`afterAll`, and scope every query to the run's own reference.

### 2.9 MEDIUM — Reconciliation tooling missing
**Status (2026-09-23):** Fixed. The wallet job asks the provider again about each payment closed 30 minutes to 72 hours ago. Agreement sets `reconciled_at`. A disagreement (a deposit paid after it expired, a credit the provider has no record of, a refunded withdrawal the bank paid anyway, a wrong amount) flags the payment for an operator; only a bank-returned withdrawal moves money, through the existing reversal path. A provider that is still processing is retried hourly and decided after 24 hours. Migrations `20260923120000_payment_reconciliation` and `20260923120100_payment_reconcile_after`.

The dead-letter queue makes a lost webhook visible and replayable. There is still no tool that reconciles
our payment rows against a provider's settlement report, which is what catches an event the provider never
sent at all. Fix: add a nightly reconciliation job that compares `payments` rows to the provider's
settlement report and files a discrepancy ticket.

### 2.10 LOW — Failed match in batch results has no `match_id`
**Status (2026-09-23):** Fixed. A failed batch entry is `BatchRunMatchFailure` with `matchId` and `error`.

A failed match in `results` is `{"error": ...}` with no `match_id`, so a caller can only tell which match
failed by its position in the list. Fix: include `match_id` in the error envelope.

### 2.11 LOW — Dependency monitoring absent
**Status (2026-09-23):** Fixed. `.github/dependabot.yml` (npm, pip for every Python service, the Docker constraints file, Actions, Docker/compose; weekly, grouped, 7-day cooldown) and a weekly `.github/workflows/audit.yml` running `pnpm audit --audit-level high` and `pip-audit` per service. Dependabot only, no Renovate, so updates don't arrive twice.

No Dependabot or Renovate, no scheduled `pnpm audit` / `pip-audit`, no advisory subscription. Fix: enable
Dependabot + Renovate and a weekly audit job in CI.

### 2.12 LOW — Demo credentials in the seed
**Status (2026-09-23):** Unchanged; accepted for development.

`identity/src/seeds/demo.seed.ts` holds `betng-admin` / `betng-demo`. The seed refuses to run in
production and the file says so. Acceptable for development; rotate before any public staging.

### 2.13 HIGH — Key rotation was refused by the database (found while fixing §2.7)
**Status (2026-09-23):** Fixed. Migration `20260923120200_ciphertext_key_versions` makes the check accept any key version and still refuse plaintext.

`bank_accounts_ciphertext_only` and `bank_account_verifications_ciphertext_only` required
`LIKE 'v1:%'`. The key ring could write `v2:`, but the first bank-account write after a rotation
would have failed on the constraint.

## 3. Gaps — features built but not wired to a real provider

Every route below is served. What each item still needs is a live provider, credentials or storage in
place of the development adapter.

### 3.1 Payments (real money) — CRITICAL
- **Contract**: `packages/contracts/src/account/payments.type.ts` — `PaymentRecord`, `DepositInitiateRequest`,
  `DepositInitiation`, `WithdrawalRequest`, `WithdrawalQuote`, `Bank`, `BankAccount`, `BankAccountVerifyRequest`,
  `BankAccountVerification`, `SaveBankAccountRequest`, `PaymentHistoryQuery`.
- **Routes (served)** (all under `/api/v1`, in `apps/services/wallet/src/routes/payments.route.ts`):
  - `POST /payments/deposit/initiate`
  - `POST /payments/deposit/verify`
  - `GET /payments/history`
  - `POST /payments/withdraw/quote`
  - `POST /payments/withdraw/request`
  - `GET /payments/withdraw/status/:reference`
  - `GET /payments/banks`
  - `POST /payments/bank-accounts/verify`
  - `POST /payments/bank-accounts`
  - `GET /payments/bank-accounts`
  - `POST /payments/bank-accounts/:id/default`
  - `DELETE /payments/bank-accounts/:id`
  - `POST /payments/webhook/{paystack,flutterwave,bachs}`
- **Providers**: `apps/services/wallet/src/providers/` — `paystack.provider.ts`, `flutterwave.provider.ts`,
  `bachs.provider.ts`, `sandbox.provider.ts`. The real providers are written; the sandbox is what is active.
- **What to replace**: `PAYMENTS_PROVIDER=sandbox` → `paystack` (or `flutterwave`). Set
  `PAYSTACK_SECRET_KEY`, `PAYMENTS_CALLBACK_BASE_URL`, `WALLET_ENCRYPTION_KEY`. The sandbox provider
  (`sandbox.provider.ts`) is development/test only and is refused in production at start-up.
- **Real-money wiring**: `PAYMENTS_PROVIDER=paystack` requires a live `sk_live_*` key, an https callback
  base URL, and `WALLET_ENCRYPTION_KEY` (32 random bytes, base64). The wallet service refuses to start
  otherwise.

### 3.2 KYC identity verification — CRITICAL
- **Contract**: `packages/contracts/src/account/kyc.type.ts` — `KycOverview`, `KycDocument`,
  `KycUploadRequest`, `KycUploadTicket`, `BvnVerifyRequest`, `NinVerifyRequest`, `IdentityCheckResult`.
- **Routes (served)**: `GET /kyc/status`, `GET /kyc/documents`, `POST /kyc/documents/uploads`,
  `POST /kyc/documents`, `POST /kyc/verify/bvn`, `POST /kyc/verify/nin`.
- **Provider**: `apps/services/identity/src/services/kyc/identityVerification.provider.ts` — `sandbox()` and
  `unconfigured()`. The sandbox is deterministic and never calls out; `unconfigured` answers 503.
- **What to replace**: `KYC_IDENTITY_PROVIDER=sandbox` → a real BVN/NIN provider (NIBSS, or an approved
  third party). Set `KYC_STORAGE_*` (S3/GCS-compatible bucket), `KYC_STORAGE_SSE=AES256` (or `aws:kms`
  with `KYC_STORAGE_SSE_KMS_KEY_ID`), `IDENTITY_DATA_KEY` (32 bytes, base64).

### 3.3 Email delivery — HIGH
- **Provider**: `apps/services/email/` — SendByte adapter (`sendbyte.provider.ts`). `EMAIL_SERVICE_PROVIDER=log`
  is development only; production refuses it.
- **What to replace**: `EMAIL_SERVICE_PROVIDER=sendbyte`, `SENDBYTE_API_KEY`, `SENDBYTE_WEBHOOK_SECRET`,
  `EMAIL_FROM`, `EMAIL_FROM_NAME`. The webhook secret is the endpoint's `whsec_…` value; during a
  rotation list both comma-separated so deliveries signed with either are accepted.

### 3.4 SMS delivery — HIGH
- **Provider**: `apps/services/identity/src/services/delivery/` — Termii adapter. `SMS_PROVIDER=none` or `log`.
- **What to replace**: `SMS_PROVIDER=termii`, `TERMII_API_KEY`, `TERMII_SENDER_ID`, `TERMII_BASE_URL`,
  `TERMII_CHANNEL`. The base URL must be the one shown on the Termii dashboard (https).

### 3.5 Push (FCM) — MEDIUM
- **Provider**: `apps/services/identity/src/services/delivery/webPush.*` — FCM HTTP v1 with OAuth assertion
  signing, token caching and single-flight refresh. It is off because `PUSH_PROVIDER=none`, not because it
  is unwritten.
- **What to replace**: `PUSH_PROVIDER=fcm`, `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` (PEM
  with `\n` escapes). Also `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` for web push — all three
  or none; a half configuration silently drops browser notifications.

### 3.6 Statement storage — MEDIUM
- **Provider**: `apps/services/wallet/src/storage/s3.storage.ts`. Unset: statements end FAILED with no link.
- **What to replace**: `WALLET_STORAGE_ENDPOINT` (bare https origin), `WALLET_STORAGE_REGION`,
  `WALLET_STORAGE_BUCKET`, `WALLET_STORAGE_ACCESS_KEY_ID`, `WALLET_STORAGE_SECRET_ACCESS_KEY`,
  `WALLET_STORAGE_FORCE_PATH_STYLE=true`.

### 3.7 Simulation RNG certification — CRITICAL (legal, not technical)
The simulation is deterministic from an HMAC seed (`SIMULATION_SEED_SECRET`). For a real-money product you
need an **independent RNG certification** (eCOGRA / GLI / local regulator) proving the result is fair,
unpredictable and not manipulable. This is a procurement item, not a code change.

### 3.8 Segregated player funds and merchant account — CRITICAL (legal)
Customer wallets must sit in a segregated account held in trust, and the operator needs a merchant
account for payouts. These are banking relationships, not config.

### 3.9 Licensing and regulatory approval — CRITICAL (legal)
A real-money sports-betting product needs a gambling licence in every jurisdiction it operates in, plus
age-gating, geoblocking, self-exclusion infrastructure and a responsible-gaming officer. None of this is
in the codebase.

### 3.10 Penetration testing and 24/7 support — HIGH (operational)
Before launch you need an independent pen-test against the running platform and an on-call rotation.

## 4. Security issues found

### 4.1 HIGH — KYC document storage encryption is enforced only when `KYC_STORAGE_SSE` is set
`apps/services/identity/src/services/kyc/storage.provider.ts` signs the `x-amz-server-side-encryption`
header on the presigned PUT, so storage refuses an upload that drops it. Good. But in development the
variable is unset and documents are written unencrypted. Production refuses to start with KYC storage
configured and `KYC_STORAGE_SSE` unset, which is the right fail-closed behaviour — verify that path is
actually tested and not just documented.

### 4.2 HIGH — Encryption key rotation has no re-encryption pass
**Status (2026-09-23):** Fixed with §2.7 and §2.13.

See §2.7. A rotation config change is possible but no tool walks the rows. Until it exists the retired key
can never be dropped and `lookupHash` follows the active key, so a rotation must re-hash bank-account
lookups or lookups stop matching. This is a real data-corruption risk, not a theoretical one.

### 4.3 MEDIUM — Settlement realtime publication is not reliable
**Status (2026-09-23):** Fixed with §2.5.

See §2.5. A dropped `BET_SETTLED` signal means a bet that has been paid does not appear paid in the UI
until the 60-second REST re-read. Under load or with a bad event-service connection this is user-visible.

### 4.4 MEDIUM — No reconciliation against provider settlement reports
**Status (2026-09-23):** Fixed with §2.9.

See §2.9. The dead-letter queue catches a webhook that verified but failed to apply. Nothing catches an
event the provider never sent at all, which is the more common failure mode (provider outage, clock
skew, duplicate webhook). A payment can sit `PENDING` forever with the money already moved at the
provider.

### 4.5 MEDIUM — Risk engine reads the book on every evaluation with no cache
**Status (2026-09-23):** Not changed; see §2.6.

See §2.6. Under a burst (e.g. a goal during a popular match) this is the hottest path and every evaluation
re-reads limits, selection states and the book. Correct, but un-cached. Add a short-TTL cache and
invalidate on `BET_ACCEPTED` / `ODDS_UPDATED`.

### 4.6 LOW — Test databases are never reset
See §2.8. This is not a security issue but it produces false confidence: a suite that passes today may fail
tomorrow because of accumulated data, and the failure looks like a regression.

### 4.7 LOW — No Dependabot / Renovate / scheduled audits
**Status (2026-09-23):** Fixed with §2.11.

See §2.11. A known CVE in a transitive dependency sits unnoticed until someone trips over it.

### 4.8 INFO — Known design gaps (not vulnerabilities)
- Account updates are pushed only when realtime authentication is configured. With the default (`none`)
  account data is re-read over REST on a timer and after every action. The signal is only a prompt.
- Under `pnpm dev` the realtime endpoint is reached directly on port 3008. Only the deployment compose
  profile puts it behind the TLS edge.
- `.env.example` and the demo seed use public placeholder secrets and development keys. Production
  refuses every one of them.

### 5.2 Customer auth (`/auth`) — web and mobile

| Method | Path | Owner | Status |
| --- | --- | --- | --- |
| POST | `/auth/register` | identity | served |
| POST | `/auth/verify` | identity | served |
| POST | `/auth/verify/resend` | identity | served |
| POST | `/auth/login` | identity | served |
| POST | `/auth/login/2fa` | identity | served |
| POST | `/auth/logout` | identity | served |
| GET | `/auth/me` | identity | served |
| POST | `/auth/password/forgot` | identity | served |
| POST | `/auth/password/reset` | identity | served |
| POST | `/auth/session/refresh` | identity | served |

### 5.3 Customer account

| Method | Path | Owner | Status |
| --- | --- | --- | --- |
| PATCH | `/account/profile` | identity | served |
| GET | `/account/export` | identity | served |
| PUT | `/account/password` | identity | served |
| GET | `/account/2fa` | identity | served |
| POST | `/account/2fa/enroll` | identity | served |
| POST | `/account/2fa/confirm` | identity | served |
| POST | `/account/2fa/disable` | identity | served |
| POST | `/account/2fa/backup-codes` | identity | served |
| GET | `/account/sessions` | identity | served |
| DELETE | `/account/sessions` | identity | served |
| DELETE | `/account/sessions/:id` | identity | served |
| GET | `/account/deletion` | identity | served |
| POST | `/account/deletion` | identity | served |
| DELETE | `/account/deletion` | identity | served |
| POST | `/account/statements` | wallet | served |
| GET | `/account/statements/:id` | wallet | served |

### 5.4 Customer payments / wallet (REAL MONEY — served)

| Method | Path | Owner | Status |
| --- | --- | --- | --- |
| POST | `/payments/deposit/initiate` | wallet | served |
| POST | `/payments/deposit/verify` | wallet | served |
| GET | `/payments/history` | wallet | served |
| POST | `/payments/withdraw/quote` | wallet | served |
| POST | `/payments/withdraw/request` | wallet | served |
| GET | `/payments/withdraw/status/:reference` | wallet | served |
| GET | `/payments/banks` | wallet | served |
| POST | `/payments/bank-accounts/verify` | wallet | served |
| POST | `/payments/bank-accounts` | wallet | served |
| GET | `/payments/bank-accounts` | wallet | served |
| POST | `/payments/bank-accounts/:id/default` | wallet | served |
| DELETE | `/payments/bank-accounts/:id` | wallet | served |
| POST | `/payments/webhook/paystack` | wallet | served |
| POST | `/payments/webhook/flutterwave` | wallet | served |
| POST | `/payments/webhook/bachs` | wallet | served |

### 5.5 Customer KYC, limits, notifications (served)

| Method | Path | Owner | Status |
| --- | --- | --- | --- |
| GET | `/kyc/status` | identity | served |
| GET | `/kyc/documents` | identity | served |
| POST | `/kyc/documents/uploads` | identity | served |
| POST | `/kyc/documents` | identity | served |
| POST | `/kyc/verify/bvn` | identity | served |
| POST | `/kyc/verify/nin` | identity | served |
| GET | `/limits/summary` | identity | served |
| PUT | `/limits` | identity | served |
| DELETE | `/limits/:kind` | identity | served |
| POST | `/limits/self-exclude` | identity | served |
| DELETE | `/limits/self-exclude` | identity | served |
| GET | `/limits/history` | identity | served |
| GET | `/notifications/preferences` | identity | served |
| PUT | `/notifications/preferences` | identity | served |
| GET | `/notifications/push/devices` | identity | served |
| POST | `/notifications/push/register` | identity | served |
| DELETE | `/notifications/push/devices/:id` | identity | served |

### 5.6 Betting, wallet, settlements (served)

| Method | Path | Owner | Status |
| --- | --- | --- | --- |
| POST | `/bets` | betting | served |
| GET | `/bets` | betting | served |
| GET | `/bets/:id` | betting | served |
| GET | `/wallets/:userId` | wallet | served |
| GET | `/wallets/:userId/transactions` | wallet | served |
| POST | `/wallets/deposit` | wallet | served (simulated only) |
| POST | `/wallets/withdraw` | wallet | served (simulated only) |
| GET | `/users/:id/notifications` | identity | served |
| POST | `/users/:id/notifications/read` | identity | served |
| GET | `/settlements` | settlement | served |
| GET | `/settlements/:betId` | settlement | served |

### 5.7 Shop terminal (`/shop`) — cashier session required

| Method | Path | Owner | Status |
| --- | --- | --- | --- |
| POST | `/shop/auth/login` | identity | served |
| POST | `/shop/auth/logout` | identity | served |
| GET | `/shop/auth/session` | identity | served |
| POST | `/shop/tickets` | betting | served |
| GET | `/shop/tickets` | betting | served |
| GET | `/shop/tickets/:code` | betting | served |
| POST | `/shop/tickets/:code/payout` | betting | served |
| POST | `/shop/tickets/:code/cancel` | betting | served |
| GET | `/shop/transactions` | wallet | served |
| GET | `/shop/reports/daily` | analytics | served |
| GET | `/shop/reports/daily/range` | analytics | served |
| GET | `/shop/cashiers` | identity | served |
| GET | `/shop/shifts/current` | wallet | served |
| POST | `/shop/shifts` | wallet | served |
| POST | `/shop/shifts/current/cash` | wallet | served |
| POST | `/shop/shifts/:id/close` | wallet | served |
| GET | `/shop/shifts` | wallet | served |
| POST | `/shop/transfers` | wallet | served |
| GET | `/shop/transfers` | wallet | served |

### 5.8 Admin control plane (`/admin`) — admin session required

| Method | Path | Owner | Status |
| --- | --- | --- | --- |
| POST | `/admin/auth/login` | identity | served |
| POST | `/admin/auth/logout` | identity | served |
| GET | `/admin/auth/session` | identity | served |
| POST | `/admin/auth/activate` | identity | served |
| GET | `/admin/overview` | analytics | served |
| GET | `/admin/health/services` | gateway | served |
| GET | `/admin/users` | identity | served |
| PATCH | `/admin/users/:id` | identity | served |
| POST | `/admin/users/:id/status` | identity | served |
| POST | `/admin/users/:id/password-reset` | identity | served |
| GET | `/admin/admins` | identity | served |
| POST | `/admin/admins` | identity | served |
| PATCH | `/admin/admins/:id` | identity | served |
| POST | `/admin/admins/:id/status` | identity | served |
| POST | `/admin/admins/:id/reset-credentials` | identity | served |
| GET | `/admin/shop-applications` | identity | served |
| GET | `/admin/shop-applications/:id` | identity | served |
| POST | `/admin/shop-applications/:id/review` | identity | served |
| GET | `/admin/shops` | identity | served |
| POST | `/admin/shops` | identity | served |
| GET | `/admin/shops/:id` | identity | served |
| PATCH | `/admin/shops/:id` | identity | served |
| POST | `/admin/shops/:id/status` | identity | served |
| GET | `/admin/shops/:id/cashiers` | identity | served |
| POST | `/admin/shops/:id/cashiers` | identity | served |
| POST | `/admin/shops/:id/cashiers/:cashierId/status` | identity | served |
| POST | `/admin/shops/:id/cashiers/:cashierId/reset-credentials` | identity | served |
| GET | `/admin/audit` | identity | served |
| GET | `/admin/settings` | identity | served |
| PATCH | `/admin/settings` | identity | served |
| GET | `/admin/kyc/pending` | identity | served |
| POST | `/admin/kyc/review/:userId` | identity | served |
| GET | `/admin/kyc/documents/:id/preview` | identity | served |
| GET | `/admin/responsible-gaming` | identity | served |
| GET | `/admin/leagues` | match | served |
| POST | `/admin/leagues` | match | served |
| GET | `/admin/teams` | match | served |
| POST | `/admin/teams` | match | served |
| PATCH | `/admin/teams/:id` | match | served |
| GET | `/admin/fixtures` | match | served |
| POST | `/admin/fixtures` | match | served |
| GET | `/admin/matches/:id` | match | served |
| POST | `/admin/matches/:id/actions` | match | served |
| GET | `/admin/odds` | odds | served |
| GET | `/admin/odds/config` | odds | served |
| PUT | `/admin/odds/config` | odds | served |
| POST | `/admin/markets/:id/actions` | odds | served |
| GET | `/admin/risk/overview` | risk | served |
| GET | `/admin/risk/exposure` | risk | served |
| GET | `/admin/risk/limits` | risk | served |
| PUT | `/admin/risk/limits` | risk | served |
| GET | `/admin/simulations` | simulation | served |
| POST | `/admin/simulations/:id/actions` | simulation | served |
| GET | `/admin/simulation/config` | simulation | served |
| PUT | `/admin/simulation/config` | simulation | served |
| GET | `/admin/settlements` | settlement | served |
| POST | `/admin/settlements/:id/retry` | settlement | served |
| GET | `/admin/operator` | settlement | served |
| GET | `/admin/operator/periods` | settlement | served |
| POST | `/admin/operator/periods/close` | settlement | served |
| GET | `/admin/commission` | settlement | served |
| GET | `/admin/commission/config` | settlement | served |
| PUT | `/admin/commission/config` | settlement | served |
| GET | `/admin/wallet/overview` | wallet | served |
| GET | `/admin/payments/overview` | wallet | served |
| GET | `/admin/payments` | wallet | served |
| POST | `/admin/payments/withdrawals/:reference/review` | wallet | served |
| GET | `/admin/reports/daily` | analytics | served |
| GET | `/admin/reports/export` | analytics | served |
| GET | `/admin/analytics/overview` | analytics | served |
| GET | `/admin/analytics/breakdown` | analytics | served |
| GET | `/admin/analytics/sessions` | analytics | served |
| GET | `/admin/analytics/matches/:id` | analytics | served |
| GET | `/admin/analytics/accounts/:id` | analytics | served |
| GET | `/admin/analytics/shops/:id` | analytics | served |
| GET | `/admin/analytics/cashiers/:id` | analytics | served |

## 6. Frontend improvements

### 6.1 Replace the simulated-money wallet path with the real payments path
`apps/web/src/features/wallet/WalletActionDialog.tsx` is the no-payment-provider path. It says so
plainly: "No payment provider is enabled on this deployment, so no card or bank account is charged."
When `paymentsEnabled` is on the page uses `LinkButton to="/wallet/deposit"` instead. The real flows are
`apps/web/src/features/payments/DepositFlow.tsx` and `WithdrawFlow.tsx`. They are guarded by
`FlagGuard flag="paymentsEnabled"`. Nothing is wrong here — the wiring is correct. What is missing is
the backend. When the backend is live, flip `paymentsEnabled` on via `GET /config → features` and the
real flows appear with no client change.

### 6.2 Surface the pending-withdrawal review queue in the customer app
**Status (2026-09-23):** Done. The wallet page shows a banner when a withdrawal is pending or processing. The payment status page has a timeline built from the record's own status and timestamps, and the PENDING badge now depends on direction ("Awaiting processing" for a withdrawal).

The admin console has `POST /admin/payments/withdrawals/:reference/review` (pending). The customer app
has `GET /payments/withdraw/status/:reference` but no way to know a withdrawal is awaiting review. Add a
banner on the wallet page when any withdrawal is `PENDING` and a status timeline in the withdrawal detail
drawer.

### 6.3 KYC tier gating on betting and withdrawals
**Status (2026-09-23):** Done. A `KYC_REQUIRED` answer shows a link to `/kyc` in the withdraw flow and the bet slip, and the withdraw form shows a notice while the customer is not verified. Nothing is disabled in advance: the contract has no platform-supplied tier threshold, so the platform decides.

`packages/contracts/src/account/kyc.type.ts` defines `KycTier` and `KycOverview.limits`. The frontend has
`KycOverviewCard` and `KycStatusBadge`. Wire `KYC_REQUIRED` (403) from the platform into the bet slip and
the withdrawal form as a link to `/kyc`, and gate the "Place bet" and "Withdraw" buttons behind
`kyc.status === "VERIFIED"` (or the tier the platform requires) so the user is guided rather than refused.

### 6.4 Responsible gaming needs a visible cooling-off countdown
**Status (2026-09-23):** Done. Pending limit changes show a live countdown and refresh the summary when it reaches zero. The responsible-gaming banner mentions a pending change even when the account is not restricted.

`packages/contracts/src/account/limits.type.ts` has `ResponsibleGamingLimit` with `pendingValue` and
`pendingEffectiveAt`. `ResponsibleGamingBanner` exists but does not show the cooling-off countdown. Add a
countdown to `pendingEffectiveAt` on the banner and on the limits page, and block tightening during the
cooling-off window with a clear message.

### 6.5 Account deletion needs a blocker list
**Status (2026-09-23):** Done. The request form lists what will be deleted and the platform's blockers, and stays disabled while there are any.

`POST /account/deletion` is pending. The frontend has `AccountDeletionPage`. Add a "what will be
deleted" summary that lists open bets, pending withdrawals, saved bank accounts and KYC documents, and
disable the button until the platform reports no blockers.

### 6.6 Session refresh UX
**Status (2026-09-23):** Already handled: the route is served, and when a refresh fails the warning hides "Stay signed in" and says to sign in again.

`POST /auth/session/refresh` is pending. The session monitor warns two minutes before expiry and offers
"Stay signed in". Until the route is served that button does nothing. Add a fallback that signs the
user out and asks them to sign in again, rather than letting the button dangle.

### 6.7 TV needs an "out of date" indicator
**Status (2026-09-23):** Already visible (a status pill and an out-of-date overlay). No retry button: the TV screen has no input and keeps retrying by itself.

The TV app marks its data out of date after 20 s without the live stream. Make that visible as a banner
rather than a subtle state, and add a retry button that reconnects the WebSocket.

### 6.8 Mobile needs the same account channel as web
**Status (2026-09-23):** Already done: mobile sets `accountChannel` from `realtimeAuth`, the same way web does.

`packages/ui-core/src/adapters/platformDataSource.ts` subscribes to `user:{id}` when `accountChannel` is
true. The mobile app passes `accountChannel: false` today. Flip it on when realtime auth is configured
(`expo.extra.realtimeAuth`), and keep the 60-second REST re-read as a backstop.

### 6.9 Accessibility: keyboard navigation on the shop terminal
**Status (2026-09-23):** Done. The odds board is a real ARIA grid with one Tab stop and arrow, Home and End navigation. Code columns announce their meaning, closed prices are reachable but inert, scans are announced, and fixed ids are replaced with `useId`.

The shop terminal (`apps/shop`) uses F-key shortcuts and a week grid. Audit keyboard focus order on the
`WeekGrid`, `ManualTicketEntry` and `TicketScanner` components and add visible focus rings and `aria-label`s
for every Fastbet code button.

### 6.10 Performance: virtualise the admin lists
**Status (2026-09-23):** Not changed. Admin pages are capped at 100 rows, and virtualising them would add a dependency for no measured gain.

`AdminListTable` renders all rows. With 500-row pages and 10-row card rendering this is fine today but will
degrade as the database grows. Add windowed virtualisation to the table body and the card stack.

### 6.11 Error states should carry the request id
**Status (2026-09-23):** Done. Web, admin and shop already showed it; mobile error states now show "Support reference". The TV has no error to quote.

Every `DataSourceError` carries `detail.requestId`. `presentError` surfaces it. Verify every
`ErrorState` and `AccountErrorState` in the four browser apps renders it — a user quoting a request id to
support is the only way a backend bug is traceable.

### 6.12 Dark theme on mobile
The Expo app has been typechecked and linted but not yet captured on a device. Verify the dark theme
renders correctly on both Android and iOS before launch.

## 7. Mocks and sandboxes that must be replaced with real data

Every item below is a development/test adapter. In production the config loader refuses to start with it,
so the platform cannot accidentally ship with fake money or fake identity. The list is here so nothing is
forgotten when procurement lands.

| # | File | What it does | Must be replaced with |
| --- | --- | --- | --- |
| 1 | `apps/services/wallet/src/providers/sandbox.provider.ts` | Deterministic deposit/withdrawal; amounts ending in 13 fail, 17 expire; no money moves | A real provider (`paystack.provider.ts`, `flutterwave.provider.ts`, or `bachs.provider.ts`) with live keys |
| 2 | `apps/services/identity/src/services/kyc/identityVerification.provider.ts` `sandbox()` | Numbers starting with 0 reject, ending in 000 need action, anything else verifies; never calls out | An approved BVN/NIN provider (NIBSS or third party) |
| 3 | `apps/services/identity/src/services/kyc/identityVerification.provider.ts` `unconfigured()` | Answers 503 for every verification | The same real provider once integrated |
| 4 | `apps/services/email/src/providers/sendbyte.provider.ts` (when `EMAIL_SERVICE_PROVIDER=log`) | Logs mail to the console | SendByte with a live `SENDBYTE_API_KEY` and verified sending domain |
| 5 | `apps/services/identity/src/services/delivery/sms/termii.provider.ts` (when `SMS_PROVIDER=log`) | Logs SMS to the console | Termii with `TERMII_API_KEY`, `TERMII_SENDER_ID`, `TERMII_BASE_URL` |
| 6 | `apps/services/identity/src/services/delivery/webPush.ts` (when `PUSH_PROVIDER=none`) | No web push | FCM HTTP v1 with `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`, plus VAPID keys |
| 7 | `apps/services/wallet/src/storage/s3.storage.ts` (when unset) | Statements end FAILED with no link | A real S3/GCS-compatible bucket with `WALLET_STORAGE_*` |
| 8 | `apps/services/identity/src/services/kyc/storage.provider.ts` (when `KYC_STORAGE_*` unset) | Uploads answer 503 | A real bucket with `KYC_STORAGE_*` and `KYC_STORAGE_SSE` |
| 9 | `apps/services/wallet/src/configs/payments.config.ts` `simulatedFundsEnabled` | The `/wallets/deposit|withdraw` routes move simulated money | Disabled in production; never on beside a real provider |
| 10 | `identity/src/seeds/demo.seed.ts` | Creates `demo@betng.test`, `ops@betng.test` with published passwords | Deleted or replaced with a real onboarding flow before any public staging |
| 11 | `SIMULATION_SEED_SECRET=betng-local-development-seed-secret` | A development HMAC secret | A random 32-byte value generated at deploy time, stored in the secret store |
| 12 | `INTERNAL_SERVICE_TOKEN=betng-local-development-internal-token` | A development internal token | A random token, stored in the secret store, read from `INTERNAL_SERVICE_TOKEN_FILE` |
| 13 | `IDENTITY_DATA_KEY` (development key) | A public development key | 32 random bytes, base64, in the secret store |
| 14 | `WALLET_ENCRYPTION_KEY` (unset) | Bank account numbers unencrypted | 32 random bytes, base64, in the secret store |
| 15 | `PAYMENTS_CALLBACK_BASE_URL=http://localhost:5173` | A loopback callback URL | The real web origin customers return to, https only |

## 8. Operational requirements before launch

1. **Gambling licence** in every jurisdiction, plus age-gating, geoblocking and a self-exclusion policy.
2. **Segregated player funds** — customer wallets held in trust in a bank account separate from the
   operator's.
3. **Merchant account** for payouts.
4. **Approved RNG certification** (eCOGRA / GLI / local regulator) for the simulation.
5. **Approved KYC identity provider** for BVN/NIN verification.
6. **Real payment provider credentials** (Paystack or Flutterwave live keys).
7. **Real delivery credentials** (SendByte, Termii, FCM).
8. **Real storage** for KYC documents and statements.
9. **Independent penetration test** against the running platform.
10. **24/7 on-call** and an incident runbook.
11. **Responsible-gaming officer** and a written problem-gambling policy.
12. **Data retention and GDPR/NDPR** review for the KYC document store.

## 9. Priority order

1. **Code, done 2026-09-23:** §2.1–§2.5, §2.7, §2.9–§2.11, §2.13 and the §6 items marked done.
2. **Code, deliberately not changed:** §2.6 and §2.8. The reasons are in their status lines.
3. **Configuration once credentials exist:** §3.1–§3.6. The routes and adapters are served; what remains is live keys, buckets and provider accounts.
4. **Procurement:** §3.7–§3.10 and §8.1–§8.12. Code cannot substitute for these.

## 10. Where the documentation already agrees

`REAL_LIFE_READINESS.md` (scanned 2026-09-23) says the same thing in its section 5: "Licensing and
regulatory approval, segregated player funds and a merchant account, live provider credentials,
an approved KYC identity provider, independent RNG certification, penetration testing, and 24/7
support." This file adds the bugs, the API list, the frontend improvements and the mock inventory to
that baseline.
