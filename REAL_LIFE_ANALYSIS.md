# BetNg — Real-Life Production Analysis

Scanned: 2026-09-23. This file consolidates every finding: what is needed to run this as a real-money project, the bugs, the gaps, the security issues, the API list, the frontend improvements, and every mock/sandbox that must be replaced with real data.

## 1. Executive summary

This is a play-money simulation of a virtual football platform. It is well-engineered — 2,577 tests, a 22-step e2e scenario, five frontends, eleven services, one PostgreSQL schema per service, integer-kobo money, HMAC-seeded results, in-running odds recalculation, encryption at rest for KYC documents and bank accounts, a webhook dead-letter queue, RPC rate limiting, breach-checked passwords, mandatory admin TOTP. It is NOT a gambling platform yet.

To make it real you need procurement and compliance before you need code. The technical critical path is short. What follows separates "code we must write" from "things we must buy or license".
## 2. Bugs found in the current tree

### 2.1 HIGH — `apps/services/match` scheduler never re-prices on price-moving events (wired but not triggered)
File: `apps/services/match/src/...` scheduler loop.
The odds recalculation handler exists and is correct, but nothing in the match service calls it. During live
play odds stay static, which is exploitable by anyone watching faster than the market moves. Fix: call
`odds.recalculateOdds(matchId, state)` from the reveal loop after GOAL / RED_CARD / HALF_TIME /
SECOND_HALF events, once per batch, with the state the batch ended on.

### 2.2 HIGH — Simulation service fails to import on `main`
`controllers/simulation_controller.py` imports `BatchRunMatchBody`, `BatchRunMatchRequest`,
`BatchRunMatchResponse` from `dtos/__init__.py` and those are not re-exported. `import
betng_simulation` raises ImportError; the service never starts and its whole test suite fails to collect.
Fix: add the three names to `dtos/__init__.py`.

### 2.3 HIGH — `RecalculateOddsRequest` handler used the wrong cache key
The handler asked `simulation.calculateProbabilities(matchId, home, away)` and the simulation cached on
exactly that key, so a recalculation after a goal returned the identical pre-match distribution. The
`state` parameter now exists but only if the caller passes it. Verify the odds service passes the live
state through on every recalculation.

### 2.4 HIGH — `odds_snapshots.reason` CHECK constraint rejected in-running reasons
`CHECK (reason IN ('INITIAL','ADMIN_REPRICE','STATUS_CHANGE'))` while `_snapshot_reason` returns
GOAL / RED_CARD / HALF_TIME / SECOND_HALF. Any recalculation would have failed on a constraint
violation. Migration `002_in_running_snapshots.sql` widens it — confirm it is applied and that the
constraint is `INITIAL | ADMIN_REPRICE | STATUS_CHANGE | GOAL | RED_CARD | HALF_TIME | SECOND_HALF`.

### 2.5 MEDIUM — Settlement realtime publication is fire-and-forget
`settlement/src/clients/bet.signals.ts` publishes `BET_SETTLED` and logs a failure; nothing retries. A
dropped signal leaves a stale account view until the 60-second REST re-read in
`packages/ui-core/src/adapters/platformDataSource.ts`. Fix: make settlement publish to the event service
with a dead-letter and retry, or make the event service pull on a timer.

### 2.6 MEDIUM — Risk engine has no caching
`evaluate_stake_handler.py` loads limits, selection states and the book on every evaluation. Deliberate
correctness choice, but under load this is the hottest path in the platform. Add a short-TTL cache keyed
by `(matchId, selectionId)` and invalidate on `BET_ACCEPTED` / `ODDS_UPDATED`.

### 2.7 MEDIUM — Re-encryption pass for key rotation does not exist
The key ring makes rotation possible; nothing walks existing rows, decrypts under the retired key and
rewrites under the active one, re-hashing `lookupHash` in the same pass. Until it exists a rotation leaves
old rows on the old key indefinitely. Fix: write `scripts/rotate-encryption-keys.sql` (or a migration)
that does the walk, and document that `lookupHash` must be re-hashed in the same pass.

### 2.8 MEDIUM — Service test databases never reset
`apps/services/match`, `apps/services/identity`, `apps/services/wallet` share one test database across
test files and nothing resets it between runs. Assertions that search globally or assert absolute counts
pass while the table is small and then fail forever. Fix: truncate or use a unique tag per test file in a
`beforeAll`/`afterAll`, and scope every query to the run's own reference.

### 2.9 MEDIUM — Reconciliation tooling missing
The dead-letter queue makes a lost webhook visible and replayable. There is still no tool that reconciles
our payment rows against a provider's settlement report, which is what catches an event the provider never
sent at all. Fix: add a nightly reconciliation job that compares `payments` rows to the provider's
settlement report and files a discrepancy ticket.

### 2.10 LOW — Failed match in batch results has no `match_id`
A failed match in `results` is `{"error": ...}` with no `match_id`, so a caller can only tell which match
failed by its position in the list. Fix: include `match_id` in the error envelope.

### 2.11 LOW — Dependency monitoring absent
No Dependabot or Renovate, no scheduled `pnpm audit` / `pip-audit`, no advisory subscription. Fix: enable
Dependabot + Renovate and a weekly audit job in CI.

### 2.12 LOW — Demo credentials in the seed
`identity/src/seeds/demo.seed.ts` holds `betng-admin` / `betng-demo`. The seed refuses to run in
production and the file says so. Acceptable for development; rotate before any public staging.

## 3. Gaps — features built but not wired to a real provider

Every item below is a typed contract with a platform adapter that answers `NOT_IMPLEMENTED` until the
backend serves it. The frontend is ready; the backend is not. These are the gaps to close.

### 3.1 Payments (real money) — CRITICAL
- **Contract**: `packages/contracts/src/account/payments.type.ts` — `PaymentRecord`, `DepositInitiateRequest`,
  `DepositInitiation`, `WithdrawalRequest`, `WithdrawalQuote`, `Bank`, `BankAccount`, `BankAccountVerifyRequest`,
  `BankAccountVerification`, `SaveBankAccountRequest`, `PaymentHistoryQuery`.
- **Routes pending** (all under `/api/v1`, in `apps/services/wallet/src/routes/payments.route.ts`):
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
- **Routes pending**: `GET /kyc/status`, `GET /kyc/documents`, `POST /kyc/documents/uploads`,
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
See §2.7. A rotation config change is possible but no tool walks the rows. Until it exists the retired key
can never be dropped and `lookupHash` follows the active key, so a rotation must re-hash bank-account
lookups or lookups stop matching. This is a real data-corruption risk, not a theoretical one.

### 4.3 MEDIUM — Settlement realtime publication is not reliable
See §2.5. A dropped `BET_SETTLED` signal means a bet that has been paid does not appear paid in the UI
until the 60-second REST re-read. Under load or with a bad event-service connection this is user-visible.

### 4.4 MEDIUM — No reconciliation against provider settlement reports
See §2.9. The dead-letter queue catches a webhook that verified but failed to apply. Nothing catches an
event the provider never sent at all, which is the more common failure mode (provider outage, clock
skew, duplicate webhook). A payment can sit `PENDING` forever with the money already moved at the
provider.

### 4.5 MEDIUM — Risk engine reads the book on every evaluation with no cache
See §2.6. Under a burst (e.g. a goal during a popular match) this is the hottest path and every evaluation
re-reads limits, selection states and the book. Correct, but un-cached. Add a short-TTL cache and
invalidate on `BET_ACCEPTED` / `ODDS_UPDATED`.

### 4.6 LOW — Test databases are never reset
See §2.8. This is not a security issue but it produces false confidence: a suite that passes today may fail
tomorrow because of accumulated data, and the failure looks like a regression.

### 4.7 LOW — No Dependabot / Renovate / scheduled audits
See §2.11. A known CVE in a transitive dependency sits unnoticed until someone trips over it.

### 4.8 INFO — Known design gaps (not vulnerabilities)
- Account updates are pushed only when realtime authentication is configured. With the default (`none`)
  account data is re-read over REST on a timer and after every action. The signal is only a prompt.
- Under `pnpm dev` the realtime endpoint is reached directly on port 3008. Only the deployment compose
  profile puts it behind the TLS edge.
- `.env.example` and the demo seed use public placeholder secrets and development keys. Production
  refuses every one of them.
