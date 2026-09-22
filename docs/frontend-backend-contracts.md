# Frontend ↔ Backend Contracts

The five clients (web, mobile, TV, shop, admin) and the services share one set of wire contracts: `@betng/contracts` (zod schemas + TypeScript types). This document says which contracts exist, who is authoritative for each value, how the client treats each answer, and which contracts are **proposals waiting for a backend implementation**. The per-screen wiring (endpoint, cache key, invalidation, realtime event) is in [`frontend-api-matrix.md`](./frontend-api-matrix.md); the served route table is `apps/gateway/src/routes/gateway.table.ts`.

## 1. Rules both sides hold to

| Rule | Where it is enforced |
| --- | --- |
| Money is an integer in minor units (kobo). `₦500.00` travels as `50000`. | `minorUnitsSchema` (`z.int()`); the SDK rejects a float on every validated route |
| One canonical id per entity. A match is `match.id` everywhere: web, mobile, TV, shop, admin, events, betting, settlement, analytics. | `brandedIdSchema`; no client mints ids for platform entities |
| The platform decides: balances, available/pending/reserved, bet acceptance, odds, market status, results, scores, winning gap, settlement, payouts, risk decisions, exposure, payment status, KYC status, limit status, shift totals, operator figures. | Clients render these values. The only client arithmetic is an informational bet-slip return estimate, labelled as such, and `available = balance − reserved`, which the wallet contract defines |
| Commands that move money or state carry an `idempotency-key` header; a retry of the same logical operation re-sends the same key. | `RequestOptions.idempotencyKey`; `createIdempotencyKey()` is called once per operation, never per retry |
| Mutating requests are never retried automatically. Only `GET` retries on network errors, timeouts and 502/503/504, with backoff and jitter. | `packages/client-sdk/src/rest/request.ts` |
| Every request carries `x-request-id`; the id survives into the client error model and is shown as a support reference. | `REQUEST_ID_HEADER`, `DataSourceError.detail.requestId` |
| Errors use one envelope: `{ error: { code, message, requestId, details?, data? } }`. | `errorResponseSchema`; `translateApiError` maps codes to `DataSourceErrorCode` |
| Links the platform hands out (checkout, upload target, signed download, document preview) are https only, and the client additionally requires the host to be on a configured allowlist before navigating or uploading. | `httpsUrlSchema`; `isAllowedExternalUrl` with `VITE_CHECKOUT_HOSTS` / `VITE_UPLOAD_HOSTS` |
| Provider secrets (Paystack, Flutterwave, Bachs, Termii, SendGrid, NIBSS, NIN verification), internal service tokens and session secrets never reach a client. Clients only talk to the BetNG gateway. | `scripts/check-public-env.mjs` in CI; `docs/security-headers.md` |

## 2. Response validation

Routes added for real-money operation are validated in the SDK before a screen sees them (`validated`, `validatedList`, `validatedPage` in `packages/client-sdk/src/rest/validated.ts`). A response that does not match its schema becomes `BetNgApiError { kind: "parse", code: "INVALID_RESPONSE" }`, which screens present as "Something went wrong" with the request reference; a malformed shape never renders. Examples the tests pin down: a float amount, an unknown payment status, an unmasked account number, a page without paging fields, a `javascript:` upload URL.

The original served routes (matches, odds, bets, wallet, shop, admin) are typed but not schema-validated in the SDK; their adapters normalise them into view models.

## 3. Error codes the client understands

| Platform `error.code` / status | Client code | Screen behaviour |
| --- | --- | --- |
| `VALIDATION_FAILED`, `INVALID_BET`, 400, 422 | `VALIDATION` | Field errors from `details[]` are attached to the form |
| 401, `UNAUTHENTICATED`, `SESSION_EXPIRED` | `SESSION_EXPIRED` (or `INVALID_CREDENTIALS` on a login form) | Session expires, private caches are dropped, private realtime is reconnected anonymously, sign-in dialog keeps the route and bet slip |
| `FORBIDDEN`, 403 | `FORBIDDEN` | Permission-denied state; UI guards are presentation only |
| `NOT_FOUND`, 404 | `NOT_FOUND` — or `NOT_IMPLEMENTED` on a pending-backend route | "Not available yet" instead of a misleading "not found" |
| `NOT_IMPLEMENTED`, 501, 405 on pending routes | `NOT_IMPLEMENTED` | Unavailable state; never fake data |
| `CONFLICT`, 409 | `CONFLICT` | "Already changed — refresh" |
| `RATE_LIMITED`, 429 (+ `Retry-After`) | `RATE_LIMITED` | "Too many requests. Wait N seconds before trying again." Financial commands are not retried |
| `MARKET_CLOSED` | `BETTING_CLOSED` | Selection disabled |
| `ODDS_CHANGED` (`data.current`) | `ODDS_CHANGED` | Slip shows old → new price; the user accepts explicitly; nothing is changed silently |
| `STAKE_LIMITED` (`data.maxStake`) | `STAKE_LIMITED` | Stake field shows the platform's limit |
| `RISK_REJECTED` | `BET_REJECTED` | Rejection with the platform's safe reason |
| `INSUFFICIENT_FUNDS` | `INSUFFICIENT_FUNDS` | Balance message, deposit link |
| `LIMIT_EXCEEDED` | `LIMIT_EXCEEDED` | Responsible-gaming limit message |
| `SELF_EXCLUDED` | `SELF_EXCLUDED` | Restricted-account state |
| `KYC_REQUIRED` | `KYC_REQUIRED` | Link to verification |
| `PAYMENT_FAILED` | `PAYMENT_FAILED` | Payment failure with the platform's safe reason |
| `*_UNAVAILABLE`, 502, 503, `PAYMENT_PROVIDER_UNAVAILABLE` | `UNAVAILABLE` | Retryable "temporarily unavailable" |
| 504 / client timeout | `TIMEOUT` | Retryable |
| no response | `NETWORK` / `OFFLINE` | Offline state; nothing is queued for later |
| login answered `{ twoFactor: TwoFactorChallenge }` | `TWO_FACTOR_REQUIRED` with `detail.challenge` | Code step (TOTP or backup code) |

5xx messages are replaced by the client's own wording so internals never reach the screen.

## 4. Contract inventory

### Served by the platform today

| Domain | Contracts (`packages/contracts/src/…`) |
| --- | --- |
| Catalogue and matches | `match/*`: `League`, `Team`, `Fixture`, `Match`, `MatchStatus`, `MatchEvent`, `MatchStats`, `Standings`, `TopScorer`; discovery (`SearchResponse`, `PublicConfig`, lineups, head-to-head) |
| Odds | `odds/*`: `Market`, `MarketStatus`, `Selection`, `MatchOdds` |
| Betting | `betting/*`: `PlaceBetRequest`, `Bet`, `BetSelection`, `BetStatus` |
| Wallet | `wallet/*`: `Wallet` (`balance`, `reserved`), `Transaction`, `DepositRequest`, `WithdrawRequest` (the platform's own ledger routes, not a payment provider) |
| Settlement | `settlement/*`: `Settlement`, `SettlementOutcome` |
| Realtime | `realtime/*`: `LiveEvent`, client/server frames, `matchChannel` |
| Auth | `auth/*`: customer register/verify/login, `CustomerSession`, `CustomerProfile` |
| Shop | `shop/shop.type.ts`: `Shop`, `Cashier`, `ShopRole` (`OWNER`/`MANAGER`/`CASHIER`), `ShopSession`, `Ticket`, `TicketStatus`, `ShopTransaction`, `ShopDailyReport` |
| Admin and platform | `admin/*`, `platform/*`, `risk/*`: sessions, audit log, service health, fixtures, market odds, risk overview/exposure/limits, simulation runs, settlements, operator ledger and periods, commission, analytics overview/breakdown/sessions |

### Proposed by the frontend, pending backend implementation

Each is a typed interface with a platform adapter that calls the documented route. Until the route is served the adapter answers `NOT_IMPLEMENTED` and the screen shows an unavailable state; the feature is also off by default behind a flag the platform turns on through `GET /config → features`.

| Contract file | Types | Flag |
| --- | --- | --- |
| `account/payments.type.ts` | `PaymentProvider` (`PAYSTACK`/`FLUTTERWAVE`/`BACHS`, chosen server-side), `PaymentMethod`, `PaymentStatus` (`INITIATED`→`PENDING`→`PROCESSING`→`CONFIRMED`/`FAILED`/`CANCELLED`/`EXPIRED`/`REVERSED`), `PaymentRecord`, `DepositInitiateRequest`, `DepositInitiation` (`checkoutUrl` or `instructions`), `WithdrawalRequest`, `WithdrawalQuote` (fee and net from the platform), `Bank`, `BankAccount` (always masked), `BankAccountVerifyRequest`, `BankAccountVerification` (name enquiry), `SaveBankAccountRequest` (by `verificationId`, never a client-supplied name) | `paymentsEnabled` |
| `account/kyc.type.ts` | `KycStatus` (`NOT_STARTED`/`PENDING`/`VERIFIED`/`REJECTED`/`REQUIRES_ACTION`), `KycTier`, `KycOverview`, `KycDocument`, `KycUploadRequest` (`image/jpeg`, `image/png`, `application/pdf`, ≤ 10 MB), `KycUploadTicket` (short-lived single-use https target), `BvnVerifyRequest`, `NinVerifyRequest`, `IdentityCheckResult` | `kycEnabled` |
| `account/limits.type.ts` | `LimitKind` (`deposit_daily`/`_weekly`/`_monthly`, `loss_daily`/`_weekly`, `session_minutes`), `LimitStatus` (`requested`/`active`/`pending`/`expired`), `ResponsibleGamingLimit` (with `pendingValue`/`pendingEffectiveAt` for a cooling-off change), `SelfExclusion`, `SelfExcludeRequest`, `LimitHistoryEntry`, `LimitsSummary` (`restricted`) | `responsibleGamingEnabled` |
| `account/security.type.ts` | `PasswordChangeRequest`, `PasswordResetConfirmRequest`, `TwoFactorStatus`, `TwoFactorEnrollment` (shown once), `TwoFactorChallenge`, `BackupCodes`, `AccountSession`, `SessionRefresh`, `AccountDeletion`, `StatementRequest`, `StatementJob` | `twoFactorEnabled`, `accountSessionsEnabled`, `accountDeletionEnabled`, `statementsEnabled` |
| `account/devices.type.ts` | `ChannelPreferences` (email/sms/push × topics, `locked` entries), `PushDevice`, `RegisterPushDeviceRequest` | `notificationChannelsEnabled` |
| `shop/shift.type.ts` | `CashierShift`, `ShiftTotals` (all platform-computed), `OpenShiftRequest`, `CashMovementRequest`, `CloseShiftRequest` (denomination counts + PIN) | `cashShiftsEnabled` |
| `admin/compliance.type.ts` | `KycReviewItem`, `KycReviewDecision`, `KycDocumentPreview` (signed URL), `AdminPayment`, `PaymentOverview`, `WithdrawalReview`, `ResponsibleGamingAccount`; permissions `kyc:read`, `kyc:write`, `payments:read`, `payments:write` | `complianceEnabled` |

## 5. Pending backend routes

All under `/api/v1`. "Customer" means the gateway resolves a `CUSTOMER` actor from the session and scopes every read and write to that user; no route takes a user id from the client.

| Method | Path | Request | Response | Access | Notes for the backend |
| --- | --- | --- | --- | --- | --- |
| POST | `/payments/deposit/initiate` | `DepositInitiateRequest`, `idempotency-key` | `DepositInitiation` | Customer | Picks the provider, creates the provider transaction, returns an allowlisted `checkoutUrl` or `instructions`. Enforces deposit limits, self-exclusion and KYC tier |
| POST | `/payments/deposit/verify` | `{ reference }` | `PaymentRecord` | Customer | Re-queries the provider; the only way a client learns the outcome. Crediting happens on the verified webhook or this check, exactly once |
| GET | `/payments/history` | `page`, `pageSize`, `direction`, `status` | `Page<PaymentRecord>` | Customer | |
| POST | `/payments/withdraw/quote` | `WithdrawalRequest` | `WithdrawalQuote` | Customer | Fee and net are the platform's |
| POST | `/payments/withdraw/request` | `WithdrawalRequest`, `idempotency-key` | `PaymentRecord` | Customer | Reserves funds atomically; KYC tier and limits enforced |
| GET | `/payments/withdraw/status/:reference` | — | `PaymentRecord` | Customer | |
| GET | `/payments/banks` | — | `{ items: Bank[] }` | Customer | |
| POST | `/payments/bank-accounts/verify` | `BankAccountVerifyRequest` | `BankAccountVerification` | Customer | Name enquiry through the provider; returns masked number and account name |
| POST | `/payments/bank-accounts` | `SaveBankAccountRequest` | `BankAccount` | Customer | Saves from the verification only |
| GET | `/payments/bank-accounts` | — | `{ items: BankAccount[] }` | Customer | Masked numbers only |
| POST | `/payments/bank-accounts/:id/default` | — | `BankAccount` | Customer | |
| DELETE | `/payments/bank-accounts/:id` | — | `204` | Customer | Refuse while a withdrawal to it is in flight |
| POST | `/payments/webhook/{paystack,flutterwave,bachs}` | provider payload | `200` | Provider signature | Never called by a client |
| GET | `/kyc/status` | — | `KycOverview` | Customer | |
| GET | `/kyc/documents` | — | `{ items: KycDocument[] }` | Customer | No storage URLs |
| POST | `/kyc/documents/uploads` | `KycUploadRequest` | `KycUploadTicket` | Customer | Short-lived, single-use, size- and type-bound signed target |
| POST | `/kyc/documents` | `{ uploadId }` | `KycDocument` | Customer | Server re-validates type and size and scans the file |
| POST | `/kyc/verify/bvn` | `BvnVerifyRequest` | `IdentityCheckResult` | Customer | Numbers never logged |
| POST | `/kyc/verify/nin` | `NinVerifyRequest` | `IdentityCheckResult` | Customer | Numbers never logged |
| GET | `/limits/summary` | — | `LimitsSummary` | Customer | |
| PUT | `/limits` | `{ kind, value }` | `LimitsSummary` | Customer | Tightening applies at once; loosening waits out a cooling-off period |
| DELETE | `/limits/:kind` | — | `LimitsSummary` | Customer | Removal waits out the cooling-off period |
| POST | `/limits/self-exclude` | `SelfExcludeRequest` | `SelfExclusion` | Customer | Password re-check; blocks betting and deposits immediately |
| DELETE | `/limits/self-exclude` | — | `SelfExclusion` | Customer | Refused before `canCancelAt` |
| GET | `/limits/history` | — | `{ items: LimitHistoryEntry[] }` | Customer | |
| POST | `/auth/login` (extended) | `CustomerLoginRequest` | `CustomerSession` or `{ twoFactor: TwoFactorChallenge }` | Public | |
| POST | `/auth/login/2fa` | `TwoFactorChallengeRequest` | `CustomerSession` | Public (challenge) | Attempt-limited |
| POST | `/auth/password/reset` | `PasswordResetConfirmRequest` | `204` | Public | Revokes every session |
| POST | `/auth/session/refresh` | — | `SessionRefresh` | Customer | Cookie sessions refresh by `Set-Cookie` |
| PUT | `/account/password` | `PasswordChangeRequest` | `204` | Customer | Breach check returned as a `VALIDATION` field error on `newPassword` |
| GET | `/account/2fa` | — | `TwoFactorStatus` | Customer | |
| POST | `/account/2fa/enroll` | — | `TwoFactorEnrollment` | Customer | Secret generated and stored server-side |
| POST | `/account/2fa/confirm` | `TwoFactorConfirmRequest` | `BackupCodes` | Customer | Codes shown once; stored hashed |
| POST | `/account/2fa/disable` | `TwoFactorDisableRequest` | `TwoFactorStatus` | Customer | Password + code |
| POST | `/account/2fa/backup-codes` | `{ code }` | `BackupCodes` | Customer | Replaces the previous set |
| GET | `/account/sessions` | — | `{ items: AccountSession[] }` | Customer | Location only if the platform derives it |
| DELETE | `/account/sessions/:id` | — | `204` | Customer | Revocation must take effect at the gateway at once |
| DELETE | `/account/sessions` | — | `204` | Customer | All but the current session |
| GET / POST / DELETE | `/account/deletion` | `AccountDeletionRequest` + `idempotency-key` on POST | `AccountDeletion` | Customer | |
| POST | `/account/statements` | `StatementRequest` | `StatementJob` | Customer | Generated server-side from the ledger |
| GET | `/account/statements/:id` | — | `StatementJob` | Customer | `downloadUrl` is short-lived and signed |
| GET / PUT | `/notifications/preferences` | `{ channels }` on PUT | `ChannelPreferences` | Customer | |
| GET | `/notifications/push/devices` | — | `{ items: PushDevice[] }` | Customer | |
| POST | `/notifications/push/register` | `RegisterPushDeviceRequest` | `PushDevice` | Customer | |
| DELETE | `/notifications/push/devices/:id` | — | `204` | Customer | |
| GET | `/shop/shifts/current` | — | `{ shift: CashierShift \| null }` | Cashier | |
| POST | `/shop/shifts` | `OpenShiftRequest`, `idempotency-key` | `CashierShift` | Cashier | |
| POST | `/shop/shifts/current/cash` | `CashMovementRequest`, `idempotency-key` | `CashierShift` | Cashier (+ permission) | |
| POST | `/shop/shifts/:id/close` | `CloseShiftRequest`, `idempotency-key` | `CashierShift` | Cashier | Platform computes expected cash and discrepancy |
| GET | `/shop/shifts` | `date?` | `{ items: CashierShift[] }` | Cashier (`reports:read` for others') | |
| GET | `/admin/kyc/pending` | `page`, `pageSize`, `search`, `status` | `Page<KycReviewItem>` | Admin `kyc:read` | |
| POST | `/admin/kyc/review/:userId` | `KycReviewDecision` | `KycReviewItem` | Admin `kyc:write` | Audit-logged |
| GET | `/admin/kyc/documents/:id/preview` | — | `KycDocumentPreview` | Admin `kyc:read` | Signed, short-lived; access audit-logged |
| GET | `/admin/payments/overview` | — | `PaymentOverview` | Admin `payments:read` | |
| GET | `/admin/payments` | `page`, `pageSize`, `search`, `direction`, `status`, `provider`, `from`, `to` | `Page<AdminPayment>` | Admin `payments:read` | |
| POST | `/admin/payments/withdrawals/:reference/review` | `WithdrawalReview` | `AdminPayment` | Admin `payments:write` | Audit-logged |
| GET | `/admin/responsible-gaming` | `page`, `pageSize`, `search`, `flag` | `Page<ResponsibleGamingAccount>` | Admin `users:read` | |

## 6. Sessions

The SDK supports both session transports; the platform chooses.

- **Bearer (served today).** The token is returned in the session body, kept for the tab's lifetime in `sessionStorage`, and sent as `Authorization: Bearer`. It is cleared on sign-out, on expiry and on any 401.
- **HttpOnly cookie (`VITE_AUTH_TRANSPORT=cookie`).** Requests are sent with `credentials: "include"`, no `Authorization` header, and `x-csrf-token` echoing the readable `betng_csrf` cookie on every non-GET request (double-submit). The client never reads the session cookie and persists only who is signed in and until when (`withoutCredential`). The backend must set `HttpOnly; Secure; SameSite=Lax` (or `Strict`) on the session cookie, a separate readable CSRF cookie, and verify the header.

In both modes the session monitor warns two minutes before the platform-issued `expiresAt`, offers "Stay signed in" (`POST /auth/session/refresh`), and on expiry or revocation drops private caches and reconnects realtime without the session.

## 7. Local development

There is no development stand-in: every interface above is served by its platform adapter, and local development and the browser suites run the platform itself (`pnpm dev`, or `scripts/e2e/serve.mjs`; see [`development.md`](./development.md#local-platform)). App tests use in-memory fakes of these interfaces. The seeded demo accounts are listed in [`development.md`](./development.md#demo-accounts).
