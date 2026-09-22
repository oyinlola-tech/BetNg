# Gateway

The public API edge: routing to the owning service, authentication through identity, RBAC, rate limits, body limits, security headers and IP blocking. The route table is `src/routes/gateway.table.ts`; every route names its upstream, the actor kind and permission it needs, and its limits.

## Request pipeline

1. `x-request-id`: a caller's id (8–128 of `A-Za-z0-9_.:-`) is kept, anything else is replaced with a UUID. Every response carries it, errors included, and it is forwarded upstream.
2. Security headers on every response: `x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy: no-referrer`, `permissions-policy`, `cross-origin-opener-policy: same-origin`, `content-security-policy: default-src 'none'`, `cache-control: no-store`, and `strict-transport-security` when `GATEWAY_HSTS` is on.
3. IP blocklist: the static `GATEWAY_IP_BLOCKLIST` ranges, then the Redis set `<prefix>:blocked-ips` (exact addresses; `SADD gateway:blocked-ips 203.0.113.9`). A blocked address gets `403` before CORS, routing or authentication.
4. CORS for the configured origins.
5. Global per-address limit on every route except `/health`, `/ready`, `/metrics`.
6. Per route: body limit, per-address limits, authentication and permission, per-actor limits, then the proxy call. The upstream request is built from scratch; only the resolved actor headers, the idempotency key and, for webhooks, the provider signature header travel.

Webhooks (`POST /payments/webhook/{paystack,flutterwave,bachs}`) are public, carry the smaller body limit, and are forwarded byte for byte with `content-type`, the provider's signature header (`x-paystack-signature`, `verif-hash`, `x-bachs-signature`) and `x-betng-client-ip`. Account routes to identity carry `x-betng-session-hash` (sha256 hex of the bearer) so identity can tell the caller's own session apart; the token itself is never forwarded on actor routes.

## Rate limits

Counters live in Redis at `<prefix>:rate:<name>:<scope>:<subject>` with a fixed window. A limited request gets `429 RATE_LIMITED` with `Retry-After`.

| Limit | Scope | Routes | Default | Redis down |
| --- | --- | --- | --- | --- |
| `global` | address | every route | 300 / 60 s (3000 outside production) | open |
| `credential` | address | login, register, verify, 2FA challenge, password forgot/reset, shop and admin login | 10 / 60 s | open (identity keeps its own lockout) |
| `bets` | actor | `POST /bets` | 30 / 60 s | **closed (503)** |
| `deposits` | actor | `POST /payments/deposit/initiate`, `POST /wallets/deposit` | 10 / 300 s | **closed** |
| `withdrawals` | actor | `POST /payments/withdraw/request`, `POST /wallets/withdraw` | 5 / 600 s | **closed** |
| `kycUploads` | actor | `POST /kyc/documents/uploads`, `POST /kyc/documents` | 10 / 3600 s | **closed** |
| `verification` | actor | BVN, NIN, bank-account name enquiry, password change, 2FA confirm/disable/backup codes, account deletion, self-exclusion | 5 / 600 s | **closed** |
| `statements` | actor | `POST /account/statements` | 5 / 3600 s | open |
| `webhooks` | address | provider webhooks | 600 / 60 s | open |
| `health` | address and actor | `GET /admin/health/services` (admin `health:read`) | 30 / 60 s | open |

Fail-open limits let reads keep working through a Redis outage and log one warning; fail-closed limits answer `503 SERVICE_UNAVAILABLE` with `Retry-After: 5` because money and paid identity checks must not run unmetered. After a Redis failure the limiter skips Redis for 2 s so requests do not queue on a dead connection. The dynamic blocklist is skipped while Redis is down; the static list always applies.

## Session cache

A resolved session is cached at `gateway:actor:<sha256 hex of the token>` for `GATEWAY_ACTOR_CACHE_SECONDS` (default 5, at most 10) and never past the session's expiry. Identity deletes that key when it revokes a session, so the next request resolves afresh.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `CORS_ORIGINS` | local app origins | Comma list; `*` is refused |
| `GATEWAY_ACTOR_CACHE_SECONDS` | `5` | Session cache TTL, 0–10 |
| `GATEWAY_RATE_<NAME>` | table above | `<limit>/<windowSeconds>`; `0/<window>` disables. Names: `GLOBAL`, `CREDENTIAL`, `BETS`, `DEPOSITS`, `WITHDRAWALS`, `STATEMENTS`, `KYC_UPLOADS`, `VERIFICATION`, `WEBHOOKS`, `HEALTH` |
| `LOGIN_RATE_LIMIT`, `LOGIN_RATE_WINDOW_SECONDS` | — | Older names for the credential limit, used when `GATEWAY_RATE_CREDENTIAL` is unset |
| `GATEWAY_MAX_BODY_BYTES` | `65536` | Body limit for API routes (`413 PAYLOAD_TOO_LARGE`) |
| `GATEWAY_WEBHOOK_MAX_BODY_BYTES` | `32768` | Body limit for provider webhooks |
| `GATEWAY_TRUST_PROXY` | off | Proxy hops (`1`) or proxy addresses/CIDRs whose `x-forwarded-for` is believed; `*` is refused. Set it behind a load balancer or every client shares one address |
| `GATEWAY_HSTS` | on in production | `on`/`off` |
| `GATEWAY_IP_BLOCKLIST` | empty | Comma list of addresses and CIDR ranges, IPv4 or IPv6; validated at start-up |
| `GATEWAY_REDIS_PREFIX` | `gateway` | Namespace for counters and the dynamic blocklist |
| `REDIS_URL` | — | Required in production |

Bodies above 1 MiB are refused by the HTTP adapter before any route runs.

## Tests

`tests/gateway.test.ts` (access control, forged headers, CORS) and `tests/gateway.hardening.test.ts` (global, credential and per-actor limits with `Retry-After`, fail closed on money routes and open on reads with Redis unreachable, body limits, byte-for-byte webhook passthrough, security headers, request ids, static and Redis blocklists, session cache eviction, session hash, new routes' access, internal `/metrics`). The hardening suite needs Redis at `REDIS_URL` (default `redis://localhost:56379`).
