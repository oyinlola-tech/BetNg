# identity service

Customers, admins, shops, cashiers, sessions, RBAC, audit and platform settings, plus customer account security (2FA, password reset and change, sessions, deletion), notification channels and message delivery, KYC, and responsible-gaming limits. Port 3010, schema `identity`.

## Customer routes

All under `/api/v1`. The caller is the holder of the bearer token on token routes, otherwise the gateway's `CUSTOMER` actor; a user id is never taken from a path or body. On `/account/*` the gateway also sends `x-betng-session-hash` (sha256 of the bearer), which identity checks against the actor and uses to know the current session.

| Route | Notes |
| --- | --- |
| `POST /auth/login` | Answers `CustomerSession`, or `{ twoFactor: TwoFactorChallenge }` when 2FA is on (no session is issued). The user agent is reduced to device/browser/platform labels; no IP or location is kept |
| `POST /auth/login/2fa` | Challenge: single use, 5 minutes, 5 guesses. Failures also count towards a per-customer lock (8 → 15 minutes), so fresh challenges cannot be used to keep guessing |
| `POST /auth/password/forgot` | Always 204 in constant time. Emails a 6-digit code (15 minutes, one per minute per account) |
| `POST /auth/password/reset` | 5 guesses per code, per-address lock; every refusal (unknown address, wrong/expired/capped code) is the same 422 after the same 400 ms floor; rejects the last 5 passwords; revokes every session |
| `POST /auth/register` | Password 8-128 characters and, with `PASSWORD_BREACH_CHECK`, not in the breach corpus |
| `POST /auth/session/refresh` | Token route. Slides the expiry by `CUSTOMER_SESSION_TTL_HOURS`, never past `CUSTOMER_SESSION_MAX_HOURS` from sign-in |
| `PUT /account/password` | Current password (locked after 8 failures), no reuse of the last 5, optional breach check (`VALIDATION_FAILED` on `newPassword`); revokes every other session |
| `GET /account/2fa`, `POST /account/2fa/{enroll,confirm,disable,backup-codes}` | Secret generated server-side, AES-256-GCM at rest; 10 backup codes shown once, stored as keyed hashes; disable needs password + TOTP or backup code |
| `PATCH /account/profile` | `displayName` and/or `phone` (stored as `+` and digits). Audited with the phone masked; a security alert tells the customer. An unchanged request writes nothing |
| `GET /account/export` | One JSON object: profile, 2FA status, sessions (labels only), channel preferences, push devices, KYC status and document statuses (no files, names or identity numbers), limits and history, notifications, deletion status. Wallet and bet history are in account statements. Gateway limit `GATEWAY_RATE_EXPORTS` (3/hour) |
| `GET/DELETE /account/sessions`, `DELETE /account/sessions/:id` | Own sessions only; the current one cannot be revoked here |
| `GET/POST/DELETE /account/deletion` | POST needs the password and an `Idempotency-Key` (a replay answers the stored request). `PENDING` for `ACCOUNT_DELETION_COOLING_DAYS`; blockers (balance, open payment, open bet) are reported and the account is restricted meanwhile |
| `GET/PUT /notifications/preferences` | `email.security` is locked on; switching it off is refused |
| `GET /notifications/push/devices`, `POST /notifications/push/register`, `DELETE /notifications/push/devices/:id` | Token stored as a keyed hash plus ciphertext; never returned |
| `GET /kyc/status`, `GET /kyc/documents` | Overview and tier; documents without storage keys |
| `POST /kyc/documents/uploads` | Presigned S3 PUT (5 minutes) binding key, content type and exact length. 503 `SERVICE_UNAVAILABLE` when storage is not configured |
| `POST /kyc/documents` | By `uploadId`: HEAD must show the declared size and type, and the first bytes must match the file signature, before the document is `PENDING` |
| `POST /kyc/verify/{bvn,nin}` | Through the identity-verification provider. The number is stored only as a keyed hash plus last 4, never logged or returned; one number cannot verify two customers; under-18 dates of birth are refused |
| `GET /limits/summary`, `PUT /limits`, `DELETE /limits/:kind`, `GET /limits/history` | Tightening applies now; loosening or removal waits 24 hours (`pending` / `requested`). History is append-only |
| `POST/DELETE /limits/self-exclude` | Password check; immediate; the session is kept so the customer can still withdraw. Cannot be shortened or cancelled before it ends |

## Admin routes

| Route | Permission |
| --- | --- |
| `PATCH /admin/users/:id` (`displayName`, `phone`, `reason` required) | `users:write`; audited with before/after (phone masked); answers `AdminCustomer`; the customer gets a security alert |
| `POST /admin/users/:id/password-reset` (`reason` required) | `users:write`; emails the customer the forgot-password code (one per minute per account); 204; the code is never returned, audited or logged |
| `GET /admin/kyc/pending` (`page`, `pageSize`, `search`, `status`) | `kyc:read` |
| `POST /admin/kyc/review/:userId` (`APPROVE` / `REJECT` / `REQUEST_ACTION`, reason required) | `kyc:write`; audited in the same transaction |
| `GET /admin/kyc/documents/:id/preview` | `kyc:read`; 60-second presigned GET, issued only after the access is audited |
| `GET /admin/responsible-gaming` (`page`, `pageSize`, `search`, `flag`) | `users:read`. Flags: active self-exclusion, refused `limits.check` in 30 days, loosening in 30 days, a live session older than 6 hours |

Role grants: `SUPER_ADMIN` everything; `OPERATIONS` adds `payments:read`; `RISK_ANALYST` adds `kyc:read`, `payments:read`; `SUPPORT` adds `kyc:read`, `payments:read`. Only `SUPER_ADMIN` has `kyc:write`.

## RPC (`POST /rpc`, internal token)

| Procedure | Answer |
| --- | --- |
| `limits.check` `{ userId, action: DEPOSIT\|BET\|WITHDRAWAL, amount }` | `{ allowed: true }` or `{ allowed: false, code: SELF_EXCLUDED\|LIMIT_EXCEEDED\|ACCOUNT_RESTRICTED, message }`. Deposit usage: `wallet.payments` deposits not failed/cancelled/expired/reversed in the rolling window. Loss usage: net of `betting.bets` settled `WON`/`LOST` in the window plus open stakes. `session_minutes`: age of the newest live session. Suspended, deleted or unknown accounts refuse everything; self-exclusion and pending deletion refuse deposits and bets but not withdrawals. Refusals are recorded |
| `kyc.status` `{ userId }` | `{ status, tier, dailyDeposit, dailyWithdrawal }` (kobo). Tier = verified pillars among BVN, NIN and an identity document; allowances per tier are in `KYC_TIER_LIMITS` |
| `identity.notify` | Stores the notification (idempotent by `dedupeKey`) and fans the first copy out per the customer's channel preferences |

## Sessions and revocation

Sessions are stored by `sha256(token)` hex. Every revocation (sign-out, revoke one/others, password change or reset, suspension, cashier/shop changes, deletion) deletes `gateway:actor:<hash>` in Redis and calls the event service's `event.revokeSessions { tokenHash }`. Each side is marked done on the session row only after it confirmed (`cache_evicted_at`, `realtime_revoked_at`); a failure is retried every 15 seconds.

## Delivery

| Variable | Adapters |
| --- | --- |
| `EMAIL_PROVIDER` | `service` (hands the message to the email service over RPC, naming a template it owns) or `log` (development: logs the masked recipient and template, never a body) |
| `SMS_PROVIDER` | `termii` (`POST {TERMII_BASE_URL}/api/sms/send`), `log`, `none` |
| `PUSH_PROVIDER` | `fcm` (HTTP v1; OAuth token from an RS256 service-account assertion signed with node:crypto, cached until 2 minutes before expiry; `404` removes the device), `log`, `none` |

Identity composes no email and holds no provider key: it names a template the email service owns and passes the values, and a value that template declares secret — a code, a one-time password — is rendered there and never stored. One attempt per message with `DELIVERY_TIMEOUT_MS`. Only email carries an idempotency key, so only an SMS retry could send twice. Failures are logged with provider and status only. Verification and reset codes go by email only; security alerts (new sign-in from an unseen device, password change/reset, 2FA changes, deletion request) are stored as `SECURITY_ALERT` notifications and sent on every channel whose `security` topic is on. Identity also emits `KYC_UPDATED` after a review and at most one `LIMIT_WARNING` per limit per day. Production refuses to start with a `log` adapter or an incompletely configured provider.

## KYC providers

- Storage: any S3-compatible service over https (`KYC_STORAGE_*`), SigV4 on node:crypto. Object keys are `kyc/<customerId>/<uploadId>`; nothing from the client goes into a key. Documents are checked for size, type and file signature; they are not malware-scanned.
- `KYC_IDENTITY_PROVIDER=sandbox`: development and test only, deterministic (a number starting with 0 is rejected, one ending in 000 needs action). Refused in production.
- `KYC_IDENTITY_PROVIDER=unconfigured` (the production default): no BVN/NIN provider is integrated, so these checks answer 503 and nothing is marked verified. A real adapter implements `IdentityVerificationProvider` (`src/interfaces/kyc.interface.ts`) against the chosen provider's published API.

## Account deletion job

Every minute the compliance job completes deletions whose cooling-off has ended and whose blockers have cleared: email, name, phone and password are replaced, 2FA, push devices, preferences, notifications and pending codes are deleted, sessions are revoked, and `customer_deleted` is audited — in one transaction. Wallet, bet, settlement, KYC and audit rows keep the customer id; the ledger is never touched. The same job applies due limit changes and purges expired challenges and upload tickets.

## Admin two-factor authentication

With `ADMIN_TOTP_REQUIRED=true` (the production default) an admin without TOTP cannot sign in (403, audited). An admin normally enrols their own authenticator during activation (see **Administrators**). To re-enrol one on their behalf — a lost device — use the operator CLI, which stores the secret encrypted with `IDENTITY_DATA_KEY`, signs out the admin's sessions, audits `admin_totp_enrolled` and prints the `otpauth://` URI once:

```
pnpm --filter @betng/identity-service exec tsx src/seeds/enrolAdminTotp.cli.ts admin@example.com
```

The development seed (`SEED_DEMO_DATA=true`, refused in production) gives its two-factor admin a random secret, sealed the same way, and prints the enrolment URI once to the terminal in development. `pnpm --filter @betng/identity-service totp:dev [email]` prints the current code from the development database. `SEED_ADMIN_TOTP_SECRET` pins the secret outside production (the e2e stack sets a fresh one per run).

## Secrets

`IDENTITY_DATA_KEY` (32 bytes, base64) is the root of the AES-256-GCM key (TOTP secrets, push tokens; the row or customer id is bound as associated data) and the HMAC key (backup codes, BVN/NIN, push-token lookup), both derived with HKDF. Outside production an unset key falls back to a public development key; production refuses that key and an unset one. Codes, tokens, identity numbers and message bodies are never logged.

## Development

```
pnpm --filter @betng/identity-service db:migrate        # prisma migrate deploy, then the super-admin bootstrap
pnpm --filter @betng/identity-service db:migrate:only   # migrations alone
pnpm --filter @betng/identity-service dev
pnpm exec vitest run --project unit apps/services/identity
```

Tests run against the `betng_test_identity` database (apply migrations there with `IDENTITY_DATABASE_URL=…/betng_test_identity?schema=identity pnpm --filter @betng/identity-service db:migrate`) and the local Redis (`REDIS_URL`). They rebuild the `wallet`/`betting` tables identity reads in that database only.
## Shop applications

Anyone may apply to run a shop. `POST /shop-applications` is public and rate-limited; it writes a
`shop_applications` row and emails a six-digit code and the application's **reference**, which is 16
characters of `randomBytes` in Crockford base32 — the applicant's only handle.

```
POST /shop-applications                     submit
POST /shop-applications/:reference/verify   prove the address with the code
GET  /shop-applications/:reference/status   needs ?email= as well as the reference
```

A status lookup needs the reference **and** the address, and an unknown reference is reported exactly as a
mismatched address, so neither can be used to find the other. The applicant's view carries no internal id,
no reviewer and no reviewer's note on an approval. A partial unique index allows one live application per
address — someone turned down may apply again, someone waiting or already running a shop may not.

Reviewers hold `shop-applications:read` / `:write` (`SUPER_ADMIN` and `OPERATIONS`):

```
GET  /admin/shop-applications[?status=]     GET  /admin/shop-applications/:id
POST /admin/shop-applications/:id/review    { decision, reason, shopCode?, shopName? }
```

The decision body is `kycReviewDecisionSchema`'s shape, because it is the same kind of decision.
Approving is not a status change: in one transaction it creates the `Shop` (code generated `BNG-<STATE>-NNN`
from the applicant's state, overridable), creates the owner `Cashier` with one-time credentials, flips the
application and writes a `CRITICAL` audit row. It is conditional on the application still being open, so
two reviewers racing cannot both decide it, and an approval is refused until the address is proved.
`APPROVED` and `REJECTED` are final at the database level; `REQUIRES_ACTION` can be revisited.

## Shop staff

An owner staffs their own shop. The shop comes from the session's `x-betng-shop-id` on every route — never
from a path or a body — so no request can reach another shop:

```
GET    /shop/cashiers                        cashiers:read
POST   /shop/cashiers                        cashiers:write
POST   /shop/cashiers/:id/status             cashiers:write
POST   /shop/cashiers/:id/reset-credentials  cashiers:write
```

`cashiers:write` belongs to `OWNER` alone. An owner may not create another owner, act on their own account,
or act on a cashier at their own level, and a cashier in another shop is reported as absent rather than
forbidden. The existing `/admin/shops/:id/cashiers` routes stay for platform support.

## Administrators

There is no way to create the first administrator through the API, and no seeded account outside
development. `bootstrapSuperAdmin` (`src/seeds/bootstrapSuperAdmin.ts`) creates exactly one super
administrator from `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`. It runs at service startup and from
`pnpm --filter @betng/identity-service run bootstrap:super-admin`, and it is idempotent: with any super
administrator present it changes nothing and never overwrites a live account. Missing credentials refuse
to start in production, where the platform would otherwise have no way in, and are skipped everywhere
else.

This cannot be a SQL migration: the password hash comes from scrypt. It issues **no** authenticator
secret, so nothing secret reaches a log, a console or a backup of either.

**Activation** is the only way an account holding a one-time password can sign in, and it is two steps:

| | |
| --- | --- |
| `POST /admin/auth/activate/start` | Proves the one-time password and returns an `otpauth://` URI to enrol. A fresh secret each call, stored sealed with two-factor still **off**, so a secret handed out and never used leaves the account as it was. |
| `POST /admin/auth/activate` | Proves a code from it, takes a chosen password, switches two-factor on and issues the session. It leaves the used time step in place, so the code that activated cannot also open a sign-in. |

`LoginAdminHandler` refuses an ordinary sign-in while `must_change_password` stands — said only after the
password is proven — so a one-time password can never become a lasting one.

A super administrator manages the rest through `admins:read` / `admins:write`, which no other role holds:

```
GET    /admin/admins                        POST   /admin/admins
PATCH  /admin/admins/:id                    POST   /admin/admins/:id/status
POST   /admin/admins/:id/reset-credentials
```

Creating an administrator returns the one-time password once and nothing else — the creator never learns
the new administrator's authenticator secret, so the account has one holder from the start. A credential
reset clears the authenticator too, sending the account back through activation, and drops every session.

Guards, in the service and again in the database (`admin_management_invariants`): at most one bootstrap
account, the flag can never be granted to an existing one, at least one active super administrator must
remain (a deferred constraint trigger, so promoting one and demoting another in one transaction is fine),
and nobody may change their own role or status.

