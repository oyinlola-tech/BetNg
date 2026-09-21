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
| One public edge | Clients reach only the gateway (`/api/v1`) and the realtime endpoint. Internal REST (`/internal/*`) and `POST /rpc` are never proxied. | `apps/gateway/tests/gateway.test.ts` |
| Actor identity | The gateway resolves the bearer token, strips every inbound `x-betng-*` header and rebuilds the actor headers from the session. Services never trust a user id from a path or body over the actor. | `gateway.test.ts` (forged actor headers dropped), e2e step 22 |
| Service-to-service trust | RPC and actor headers are honoured only with `x-betng-internal-token`, compared in constant time. Production refuses to start without it, with a short one, or with the `.env.example` placeholder. | e2e step 22 (RPC without the token refused) |
| Least privilege in the database | One schema and one login per service; a service writes only its own schema. The analytics login is read-only. | `services/odds/tests/test_read_model.py`, `services/analytics/tests/test_security.py` |
| Credentials | Sessions are random tokens stored as SHA-256. Passwords and PINs are scrypt hashes. Admin 2FA is TOTP with replay refusal. Repeated failures lock the account. | `apps/services/identity/tests/*` |
| Authorisation | Every service re-checks the actor kind and permission and scopes data to the actor (roles: customer; shop OWNER, MANAGER, CASHIER; admin SUPER_ADMIN, OPERATIONS, RISK_ANALYST, SUPPORT). | `apps/services/identity/tests/rbac.test.ts`, e2e step 17 |
| Money | Integer kobo end to end (`BIGINT`), integer payout arithmetic, append-only ledgers, idempotency keys on every credit. | `apps/services/wallet/tests/ledger.test.ts`, `apps/services/settlement/tests/payout.test.ts` |
| Bet integrity | Client-sent odds, stake, user id and role are ignored or re-checked. Odds are stored at acceptance and settlement pays on them. `idempotency-key` makes a repeated submission answer the original bet and move no money. | `apps/services/betting/tests/placement.test.ts`, e2e steps 7 and 21 |
| Result integrity | A result is immutable (database triggers reject UPDATE, DELETE and TRUNCATE). No route sets a score or picks a winner, and a re-run is refused as `RESULT_IMMUTABLE`. | `services/simulation/tests/test_persistence.py`, e2e steps 11, 19 and 20 |
| Result secrecy | The seed is `HMAC-SHA256(SIMULATION_SEED_SECRET, …)`, so a result cannot be computed from the source before betting closes. Events are revealed only as the match clock reaches them. | `services/simulation/tests/test_seed_secret.py`, `test_rest.py`, e2e step 10 |
| Rate limits and headers | Login and other sensitive routes are rate limited (Redis counters). API responses carry `Content-Security-Policy: default-src 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`. CORS answers only the configured origins, never `*`. | `apps/gateway/src/middlewares/securityHeaders.middleware.ts`, `cors.middleware.ts`, `gateway.test.ts` |

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

The gateway and service suites (identity, RBAC, forged headers, ledgers, idempotency) and the client error, session and logger rules:

![TypeScript service suites: 386 tests passed](docs/images/proof/backend-ts-tests.webp)

![Client data-layer suites including error redaction and resilience](docs/images/proof/data-layer-tests.webp)

## Known limitations

These are open design gaps, not undisclosed vulnerabilities:

- The realtime endpoint serves public match channels only and does not authenticate connections yet. Account data (bets, wallet, notifications) is therefore read over authenticated REST, never pushed. The client already supports an authenticated socket for when the service does (`docs/realtime.md`).
- The realtime endpoint is reached directly in development; in a deployment it belongs behind the same edge, origin and rate rules as the gateway.
- The static front-ends set no Content-Security-Policy of their own; add one at the web server or CDN that serves them.
- Local development credentials in `.env.example` and the demo seed are placeholders. Production refuses to start with them.
