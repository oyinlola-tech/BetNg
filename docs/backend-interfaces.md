# Backend interfaces for the real-money services

The agreements the identity, wallet, betting, gateway and event services build against, so each can be implemented and tested independently. Public routes and wire shapes are in [`frontend-backend-contracts.md`](./frontend-backend-contracts.md) (section 5) and `@betng/contracts`; this file covers what passes between services.

## Ownership

| Area | Service | Schema |
| --- | --- | --- |
| Customer 2FA, password reset/change, sessions list/revoke/refresh, account deletion, notification channels, push devices, message delivery (email/SMS/push), KYC, responsible-gaming limits and self-exclusion, admin KYC and RG views | identity | `identity` |
| Payments (deposits, withdrawals, provider webhooks), bank accounts, statements, admin payments views, cashier shifts and cash movements | wallet | `wallet` |
| Limit enforcement on bets, bet pagination | betting | `betting` |
| Routing, rate limits, body limits, security headers, IP blocking, session-cache eviction | gateway | — |
| Authenticated private channels | event | — |

## RPC (identity, `POST /rpc`, internal token required)

| Procedure | Input | Output | Used by |
| --- | --- | --- | --- |
| `limits.check` | `{ userId, action: "DEPOSIT" \| "BET" \| "WITHDRAWAL", amount }` (kobo) | `{ allowed: true } \| { allowed: false, code: "SELF_EXCLUDED" \| "LIMIT_EXCEEDED" \| "ACCOUNT_RESTRICTED", message }` | wallet (deposit initiate, withdrawal request), betting (customer bet placement) |
| `kyc.status` | `{ userId }` | `{ status: KycStatus, tier: KycTier, dailyDeposit?: number, dailyWithdrawal?: number }` | wallet (tier limits on deposits and withdrawals) |
| `notify` (exists) | `NotifyCustomer` payload | `NotifiedDto` | wallet (deposit/withdrawal outcomes), identity internal |

Identity computes deposit usage by reading `wallet.payments` (below) and loss usage by reading the betting/settlement schemas; a service may read any schema.

A caller that cannot reach `limits.check` must refuse the money action with `503 SERVICE_UNAVAILABLE` (fail closed), never allow it.

## Tables other services read

`wallet.payments` — one row per deposit or withdrawal:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | |
| `reference` | text unique | the BetNG reference shown to customers |
| `user_id` | uuid | |
| `direction` | text | `DEPOSIT` \| `WITHDRAWAL` |
| `status` | text | `PaymentStatus` |
| `amount` | bigint | kobo |
| `created_at`, `updated_at`, `completed_at` | timestamptz | |

## Session revocation

Identity stores sessions by `sha256(token)` hex. Whenever it revokes or expires a session (sign-out, revoke one, revoke others, password change/reset, account restriction), it deletes the Redis key `gateway:actor:<sha256 hex of the token>` so the gateway's actor cache cannot serve the revoked session. The gateway keeps its cache TTL short as a second line of defence.

## Webhooks

Provider webhooks (`POST /api/v1/payments/webhook/{paystack,flutterwave,bachs}`) are public routes. The gateway forwards the request body **byte for byte** with the provider's signature headers (`x-paystack-signature`, `verif-hash`) and applies a body limit; wallet verifies the signature over the raw bytes before parsing, records the provider event id for idempotency, and credits or settles exactly once.

## Private realtime channels

`wallet:{userId}`, `bets:{userId}` and `notifications:{userId}` require an authenticated customer whose id matches; `admin` and `risk` require an admin with the matching permission; `shop:{shopId}` requires a cashier of that shop. The event service resolves the token through identity's `authenticate` RPC when the client sends an `AUTH` frame (`VITE_REALTIME_AUTH=frame`) or `?access_token=` (`query`), re-checks on every subscribe, and closes private subscriptions when the session is revoked or expires.

## Configuration

Every provider secret is a server-side environment variable read once at start-up, validated, never logged, and absent from `.env.example` values (placeholders only). In `production` a provider marked as selected must be fully configured or the service refuses to start; development adapters (`log` email/SMS, `sandbox` KYC) are refused in production.
