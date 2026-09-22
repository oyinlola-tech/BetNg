# Security Policy

BETNG is a portfolio simulation of a virtual football platform. It uses **play money only**: no payment provider, real-money wallet or real-world wagering is, or may be, connected to it. Even so, it is built as if it held real value, and security reports are welcome.

## Reporting a vulnerability

Please report privately. Do not open a public issue for a security problem.

1. Open the repository's **Security** tab on GitHub and choose **Report a vulnerability** (private vulnerability reporting). This creates a private advisory visible only to the maintainer.
2. Include what you found, the affected component (for example `apps/gateway` or `packages/ui-core`), steps to reproduce, and the impact you believe it has.
3. If you have a fix in mind, describe it in the advisory rather than in a public pull request.

What to expect:

| Step | Target |
| --- | --- |
| Acknowledgement | within 3 working days |
| First assessment | within 7 working days |
| Fix or mitigation for a confirmed issue | as soon as practical, prioritised by severity |
| Credit | offered in the advisory once it is published, unless you prefer otherwise |

Please test only against your own local copy. Do not run automated scanners, load tests or social-engineering attempts against anyone else's deployment.

## Supported versions

| Version | Supported |
| --- | --- |
| `main` (0.1.x) | yes |
| anything older | no |

## Scope

In scope: the gateway, the TypeScript and Python services, the shared contracts and SDK, and the web, mobile, TV, shop and admin clients in this repository.

Out of scope: the development stand-in (`packages/mock-data`, never shipped in staging or production bundles), the local Docker infrastructure defaults, demo accounts and the fixed development codes, and findings that need physical access to a developer's machine.

## Security model

The platform is authoritative and the clients are untrusted. Every rule below is enforced by the backend and proven by a test. The client-side behaviour is presentation only.

### Platform

| Control | How it is enforced | Proven by |
| --- | --- | --- |
| One public edge | Clients reach only the gateway (`/api/v1`) and the realtime endpoint. In the deployment compose profile both sit behind the TLS edge (`api.<domain>`, `wss://live.<domain>/live`), and no service publishes a host port. Internal REST (`/internal/*`), `POST /rpc` and `/metrics` are never proxied. | `apps/gateway/tests/gateway.test.ts`, `infrastructure/edge/templates/conf.d/edge.conf.template`, `infrastructure/docker/docker-compose.yml` |
| Actor identity | The gateway resolves the bearer token, strips every inbound `x-betng-*` header and rebuilds the actor headers from the session. Services never trust a user id from a path or body over the actor. | `gateway.test.ts` (forged actor headers dropped), e2e step 22 |
| Service-to-service trust | RPC and actor headers are honoured only with `x-betng-internal-token`, compared in constant time. Production refuses to start without it, with a short one, or with the `.env.example` placeholder. | e2e step 22 (RPC without the token refused) |
| Least privilege in the database | One schema and one login per service; a service writes only its own schema. The analytics login is read-only. | `services/odds/tests/test_read_model.py`, `services/analytics/tests/test_security.py` |
| Credentials | Sessions are random tokens stored as SHA-256. Passwords and PINs are scrypt hashes. Customers can turn on TOTP two-factor sign-in with single-use backup codes; admin TOTP is mandatory in production, and admin secrets can be stored encrypted. Replayed codes are refused and repeated failures lock the account. | `apps/services/identity/tests/accountSecurity.test.ts`, `staffAuth.test.ts`, `totp.test.ts` |
| Authorisation | Every service re-checks the actor kind and permission and scopes data to the actor (roles: customer; shop OWNER, MANAGER, CASHIER; admin SUPER_ADMIN, OPERATIONS, RISK_ANALYST, SUPPORT). | `apps/services/identity/tests/rbac.test.ts`, e2e step 17 |
| Money | Integer kobo end to end (`BIGINT`), integer payout arithmetic, append-only ledgers, idempotency keys on every credit. | `apps/services/wallet/tests/ledger.test.ts`, `apps/services/settlement/tests/payout.test.ts` |
| Bet integrity | Client-sent odds, stake, user id and role are ignored or re-checked. Odds are stored at acceptance and settlement pays on them. `idempotency-key` makes a repeated submission answer the original bet and move no money. | `apps/services/betting/tests/placement.test.ts`, e2e steps 7 and 21 |
| Result integrity | A result is immutable (database triggers reject UPDATE, DELETE and TRUNCATE). No route sets a score or picks a winner, and a re-run is refused as `RESULT_IMMUTABLE`. | `services/simulation/tests/test_persistence.py`, e2e steps 11, 19 and 20 |
| Result secrecy | The seed is `HMAC-SHA256(SIMULATION_SEED_SECRET, …)`, so a result cannot be computed from the source before betting closes. Events are revealed only as the match clock reaches them. | `services/simulation/tests/test_seed_secret.py`, `test_rest.py`, e2e step 10 |
| Gateway limits | A global per-address limit, tighter limits on credential routes (2FA and password reset included) and bet placement per customer, all answering 429 with `Retry-After`. Money routes fail closed and reads fail open when Redis is unreachable. Oversized bodies are refused before they reach a service, with a smaller limit for webhooks. Blocked address ranges, static or added at runtime, are refused before routing. | `apps/gateway/tests/gateway.hardening.test.ts` |
| Session resolution | The gateway caches a resolved actor for 5 seconds and identity evicts it on sign-out or revocation. Account routes send identity a hash of the session, never the token. | `gateway.hardening.test.ts` (session cache) |
| API headers and CORS | API responses, errors included, carry `Content-Security-Policy: default-src 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`. CORS answers only the configured origins, never `*`. | `apps/gateway/src/middlewares/securityHeaders.middleware.ts`, `cors.middleware.ts`, `gateway.hardening.test.ts` |
| Realtime authorisation | `match:*` and `system` are public. Every other channel (`user`, `wallet`, `bets`, `notifications`, `shop`, `admin`, `risk`) needs a session, sent as an `AUTH` frame or `?access_token=`, and must belong to the caller. The session is re-checked on subscribe and every 30 seconds, and `event.revokeSessions` drops it at once. Private channels carry signals only; the state is always re-read over authenticated REST. Connections, frames and channels are limited per address and per connection. | `apps/services/event/tests/live.test.ts` |
| Production configuration | Production refuses to start with a missing, short or development value for the internal token, the seed secret, `IDENTITY_DATA_KEY` and `WALLET_ENCRYPTION_KEY`, with sandbox or log-only providers, or with plain `http` public URLs. Any variable can be read from a file (`NAME_FILE`) for Docker and Kubernetes secrets. | `apps/services/identity/tests/providers.test.ts`, `apps/services/wallet/tests/paymentsUnit.test.ts`, `services/simulation/tests/test_seed_secret.py`, `packages/service-kit/tests/secretFiles.test.ts` |
| Static front-ends | nginx serves the four browser apps with a Content-Security-Policy built from the configured platform origins and hashed inline code, plus HSTS, `nosniff`, a strict referrer policy, a locked-down `Permissions-Policy`, COOP, CORP and `X-Frame-Options: DENY`. | `infrastructure/nginx/`, [`docs/security-headers.md`](docs/security-headers.md) |

### Clients

| Control | Where |
| --- | --- |
| The browser knows only two addresses: the public gateway and the public realtime endpoint. No service, database or Redis URL, and no secret, is ever configured in a client. Every `VITE_` variable is public by definition. | `packages/ui-core/src/runtime/clientEnv.ts` |
| Staging and production builds always use the platform. The development stand-in is loaded through a dynamic import that Vite removes from deployed bundles, and `pnpm verify` fails if a production bundle contains it. | `apps/*/src/services/runtime.ts`, `scripts/verify.sh` |
| Session tokens live in `sessionStorage` (web, shop, admin) or in memory only (mobile, since AsyncStorage is not an encrypted store). Passwords and PINs are never stored. | `apps/*/src/services/runtime.ts` |
| A rejected or expired token ends the session everywhere and the realtime connection is replaced. | `packages/ui-core/src/session.ts`, `platformClients.ts` |
| Roles and permissions come only from the platform's session. Guards hide what a role cannot use, but the platform enforces every permission again. | `apps/admin`, `apps/shop` |
| The frontend never decides a result, price, payout, balance, risk decision or bet acceptance, and never updates them optimistically. A slip's return is labelled an estimate until the platform accepts the bet. | `docs/frontend-architecture.md` |
| Server error text is never shown for a 5xx or a proxy page, and every error carries a request id to quote to support. | `packages/ui-core/src/adapters/errors.ts`, `packages/client-sdk/src/rest/request.ts` |
| The client logger redacts credentials, tokens, one-time codes, balances, stakes and personal fields before any sink sees them. | `packages/ui-core/src/logger.ts` |
| No `dangerouslySetInnerHTML`. Club crest images are accepted only from http(s) or relative URLs and fall back to the generated crest. Colours in crest specs that are not hex are replaced, never emitted. | `packages/ui-web/src/teams/TeamCrest.tsx`, `packages/brand/src/crest` |
| Every destructive admin action needs a confirmation and a written reason, and is audited by the platform. | `apps/admin/tests/safety/*` |

## Proof

The trust boundary and integrity rules run end to end against the real services on every `pnpm e2e`. Steps 7, 10, 11, 17, 19, 20, 21 and 22 are the security-relevant ones:

![End-to-end scenario: 22 steps passed](docs/images/proof/backend-e2e-scenario.webp)

The gateway and service suites (identity, 2FA, RBAC, forged headers, gateway limits, realtime authorisation, ledgers, idempotency) and the client error, session and logger rules:

![TypeScript service suites: 537 tests passed](docs/images/proof/backend-ts-tests.webp)

![Client data-layer suites including error redaction and resilience](docs/images/proof/data-layer-tests.webp)

## Known limitations

These are open design gaps, not undisclosed vulnerabilities:

- Account updates are pushed only when realtime authentication is configured (`VITE_REALTIME_AUTH` or the mobile `realtimeAuth` set to `frame` or `query`). The web and mobile apps then subscribe to `user:{id}`, where the wallet publishes `WALLET_UPDATED`. Settlement does not publish signals yet, so the apps also re-read account data over REST every 60 seconds. With the default (`none`), and in the shop and admin apps, account data is re-read over REST on a timer and after every action. The signal is only a prompt: balances and bet states are always read over REST.
- Under `pnpm dev` the realtime endpoint is reached directly on port 3008. Only the deployment compose profile puts it behind the TLS edge.
- `.env.example` and the demo seed use public placeholder secrets and development keys for local work. Production refuses every one of them.
