# API Integration

How the BETNG clients talk to the platform, and what a backend engineer needs to supply to connect them. The route-by-route checklist is [`frontend-api.md`](./frontend-api.md); this document covers the layers, configuration, errors and the contracts still awaiting confirmation.

## 1. Layers

```
UI component
  ↓ feature hook            apps/*/src/hooks (TanStack Query keys, stale times, invalidation)
  ↓ application service     apps/*/src/services (placeBet, session, bootstrap)
  ↓ data source interface   packages/ui-core/src/*DataSource.type.ts
  ↓ platform adapter        packages/ui-core/src/adapters
  ↓ SDK                     packages/client-sdk (REST + realtime)
  ↓ public gateway          /api/v1/*
  ↓ backend services
```

Rules the code holds to:

- A component never calls `fetch`, never builds a URL and never imports `@betng/client-sdk`.
- The browser only ever knows two addresses: the public gateway and the public realtime endpoint. Risk, simulation, settlement, analytics, databases, Redis and RPC are backend-to-backend and are never configured in a client.
- The platform is authoritative for match state, clock, results, odds, market status, bet acceptance, payouts, balances, risk decisions and operator figures. Clients render them; they do not derive them.
- Wire types come from `@betng/contracts` (zod schemas shared with the services). View models in `packages/ui-core/src/types` are what screens render; only the adapters map between the two.

## 2. Environment

Browser apps read these at build time through `readClientEnv` (`packages/ui-core/src/runtime/clientEnv.ts`). Nothing else is read from the environment, and no secret belongs in any of them.

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_APP_ENV` | `development` (`production` for a production build) | `development` · `test` · `staging` · `production` |
| `VITE_API_URL` | `http://localhost:3000` | Public gateway origin. `VITE_GATEWAY_URL` is still accepted |
| `VITE_WS_URL` | `ws://localhost:3008/live` | Public realtime endpoint. `VITE_LIVE_URL` is still accepted |
| `VITE_REALTIME_TRANSPORT` | `websocket` | `websocket` or `sse` |
| `VITE_REALTIME_AUTH` | `none` | How the session token reaches the realtime endpoint: `none`, `frame` (an `AUTH` frame after connect) or `query` (`?access_token=`) |
| `VITE_FEATURE_FLAGS` | none | Build-time flag overrides, e.g. `walletEnabled=false,tvEnabled=true`. Platform configuration wins over these |
| `VITE_REQUEST_TIMEOUT_MS` | `10000` | Per-request timeout |
| `VITE_LOG_LEVEL` | `info` (`warn` when deployed) | `debug` · `info` · `warn` · `error` |
| `VITE_SITE_URL` | none | Public origin of the web app, for canonical and Open Graph URLs |

`readClientEnv` also returns `problems` (a malformed URL, plain HTTP in a deployed build); apps log them at start-up.

Every build, development included, talks to the platform named by `VITE_API_URL` and `VITE_WS_URL`.

## 3. REST client

`createRestClient(config)` in `packages/client-sdk/src/rest`. One requester for every call:

- `authorization: Bearer <token>` read per request from the session store; `x-request-id` generated per request and echoed by the platform.
- `idempotency-key` on submissions that must not repeat. The gateway already forwards this header. `placeBet` sends the slip's `clientReference`, created once per submission attempt and reused on retry.
- Timeout through `AbortController`; a caller's `AbortSignal` is honoured.
- Retries: idempotent reads only (`GET`), twice, with backoff, and only for transport failures and `502/503/504`. Writes are never retried by the SDK.
- Offline is detected before the network is touched.
- A response that is not JSON (a proxy's error page) is never shown to anyone; it becomes a coded error.

### Response and error shapes

The gateway passes service payloads through unchanged: an object, or `{ items: T[] }` for a list, or `Page<T>` (`{ items, page, pageSize, total }`) for a paged list. Errors use BETNG's envelope, which `packages/service-kit` wraps around ZudoJS errors:

```json
{ "error": { "code": "STAKE_LIMITED", "message": "…", "requestId": "…", "details": [{ "path": "stake", "message": "…" }], "data": { "maxStake": 20000 } } }
```

### Error handling

`BetNgApiError` (SDK) → `translateApiError` (`ui-core/src/adapters/errors.ts`) → `DataSourceError` with one of the codes below → `presentError` (`ui-web/src/lib/errors.ts`) → title, message, tone, whether retry helps. Screens never look at an HTTP status.

| Situation | `DataSourceError.code` |
| --- | --- |
| 400, 422, `VALIDATION_FAILED`, `INVALID_BET` | `VALIDATION` (field messages in `detail.fields`) |
| 401 signed out / wrong credentials | `INVALID_CREDENTIALS` |
| 401 with a session, `SESSION_EXPIRED` | `SESSION_EXPIRED` (the session store expires; the UI keeps the user's place) |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 429 | `RATE_LIMITED` (`detail.retryAfterSeconds` from `retry-after`) |
| 500 | `SERVER` (the server's own message is never shown) |
| 501, `NOT_IMPLEMENTED` | `NOT_IMPLEMENTED` |
| 502, 503, `*_UNAVAILABLE` | `UNAVAILABLE` |
| 504, client timeout | `TIMEOUT` |
| transport failure | `NETWORK` |
| browser offline | `OFFLINE` |
| `MARKET_CLOSED` | `BETTING_CLOSED` |
| `ODDS_CHANGED` / `STAKE_LIMITED` / `RISK_REJECTED` / `INSUFFICIENT_FUNDS` | `ODDS_CHANGED` / `STAKE_LIMITED` / `BET_REJECTED` / `INSUFFICIENT_FUNDS` |

Every error carries `detail.requestId`, which error states show so a user can quote it to support.

### Bet submission

```
BetSlip (UI) → usePlaceBet (hook) → placeBet() application service → dataSource.placeBet({ selections, stake, clientReference })
  → POST /api/v1/bets   body: PlaceBetRequest   header: idempotency-key: <clientReference>
```

The result is a `BetPlacementView`: `ACCEPTED`, `LIMITED` (the platform accepted a smaller stake), `PARTIALLY_ACCEPTED`, `REJECTED` (with `reason`, `maxStake`, `rejectedSelectionIds`) or `EXPIRED`. A business refusal is a result the slip renders; only transport and session failures are thrown. The slip's totals are labelled estimates; the accepted bet's `potentialPayout` is the platform's figure. Nothing about a wallet, a bet or a market is updated optimistically.

## 4. Money, dates, configuration

- Money is integer minor units end to end. `packages/ui-core/src/money.ts` formats (`formatMoney`, `formatSignedMoney`, `formatCurrency`), parses typed amounts digit by digit (`parseMoney`) and computes the slip's display estimate in `BigInt` (`estimateReturn`, `multiplyOdds`). No float arithmetic touches an amount.
- Currency comes from `GET /config` and is applied with `configureCurrency`. Until that route is served the default is NGN.
- Dates are formatted only in `packages/ui-core/src/datetime.ts`, from platform timestamps, in the viewer's zone by default and in the competition's zone (`competitionTimezone` from configuration) on request. No component offsets a timestamp.
- Feature flags: `resolveFlags(platform.features, buildOverrides)`; React access through `FeatureFlagsProvider`, `useFlag`, `FeatureGate`.

## 5. Match state

`Match.status` and `Match.lifecycle` decide the phase (`resolvePhase`, `ui-core/src/phase.ts`); time is never an input. The minute comes from the platform's clock. No client computes a minute from kick-off time: a live match with no reported clock shows `LIVE` and no minute.

## 6. Contract status

Shapes live in `packages/contracts/src/discovery/discovery.type.ts` with fixtures in `packages/contracts/tests/wireFixtures.ts`. Until a route is served the adapter answers an empty value and the screen shows its unavailable state, so each of these lights up with no client change.

| Need | Contract | Status |
| --- | --- | --- |
| Match clock | `clock: MatchClock { period, minute, addedMinutes?, asOf, minuteLengthMs? }` on `GET /matches`, `GET /matches/:id` and live frames. Without it the adapter reads period and minute from the platform's own events on a match page, and list rows show `LIVE` without a minute | served, verified through the adapter |
| Match list semantics | `GET /matches` and `/fixtures` accept `leagueId, status, season, matchday, from, to, limit (≤ 500)`; order is `kickoffAt` ascending, descending for `status=COMPLETED`; `truncated` says when a window was cut. The adapter pushes every filter down, one request per status | served |
| Lineups | `GET /matches/:id/lineups` → `MatchLineups` | served, verified through the adapter |
| Head to head | `GET /matches/:id/head-to-head` → `HeadToHead` | served, verified through the adapter |
| Search | `GET /search?q=&kinds=&limit=` → `SearchResponse` (league, team and match hits) | served, verified through the adapter |
| Public configuration | `GET /config` → `PublicConfig` (currency, features, stake limits, competition timezone, maintenance, plus `timing`) | served, verified through the adapter |
| Paged transactions | `GET /wallets/:userId/transactions?page=&pageSize=&types=&statuses=&from=&to=&search=&sort=&direction=` → `Page<Transaction>`. An unpaged `{ items }` answer is paged by the adapter | served, verified through the adapter |
| Notifications | `GET /users/:id/notifications`, `POST …/read` | served, verified through the adapter |
| Bet submission | `idempotency-key` honoured end to end: a repeat answers the original bet and moves no money. Refusals `MARKET_CLOSED { selectionIds? }`, `ODDS_CHANGED { current }`, `STAKE_LIMITED { maxStake }`, `RISK_REJECTED`, `INSUFFICIENT_FUNDS`, `INVALID_BET` | served |
| Interrupted matches | `Match.status` values `POSTPONED`, `SUSPENDED`, `DELAYED` and `statusReason`. The clients render them; the platform does not send them | not planned |
| Team crest | optional `Team.crest { assetUrl?, shape?, pattern?, emblem?, accent? }`; without it clients draw the generated crest for the team id | optional |
| Market presentation | optional `Market.name`, `Market.group`, `Market.suspensionReason`, `Selection.status`; without them the adapter names and groups by market type | optional |
| Server-driven admin lists | `GET /admin/{users,shops,cashiers,teams,fixtures,settlements,simulations}?page=&pageSize=&sort=&direction=&search=&<filter>=` → `Page<T>`. Admin lists are unpaged `{ items }` today (audit is the exception), so the SDK cuts the page client-side; there is no cross-shop cashier route, so the adapter gathers cashiers per shop | open gap |
| Realtime account channel | see [`realtime.md`](./realtime.md) | not planned |

## 7. Connecting a backend

1. Set `VITE_API_URL`, `VITE_WS_URL`, `VITE_APP_ENV` and, if needed, `VITE_REALTIME_TRANSPORT` / `VITE_REALTIME_AUTH` for each app.
2. Build. Staging and production builds use the platform adapter with no code change.
3. Serve the routes in `frontend-api.md`. Anything not yet served degrades to an empty or unavailable state rather than an error.
4. Run `pnpm test`: `packages/contracts/tests/wire.test.ts` fails if a schema drifts from the payloads the clients are built against.

## 8. GraphQL and RPC

REST is the contract today. Because screens depend only on the data-source interfaces, a read-heavy page can move to GraphQL by changing the adapter method behind it; no component changes. Clients never call RPC; it is a backend-to-backend concern behind the gateway.

## Proof

Recorded on 2026-09-21. Screenshots are the apps running against the real platform; terminal images are real command output rendered by `scripts/docs/render-terminal.mjs`, and design sheets are rendered from the packages themselves by `scripts/docs/render-design-sheets.mjs`.

The clients' own adapter reading the running platform: configuration, leagues, a live match with its clock, markets, lineups, head to head, standings, search, and live frames over the WebSocket, with no failed request:

![Smoke check against the live platform](images/proof/smoke-platform.webp)

The payloads the clients are built against, parsed with the platform's own schemas:

![Contract fixture tests passing](images/proof/contract-tests.webp)

Money, clock and phase, the platform adapter (idempotent bet submission, refusals as results, paging fallbacks) and the requester's error mapping and retries:

![Data layer tests passing](images/proof/data-layer-tests.webp)

A bet placed through this path on the real platform, accepted with the platform's reference and payout:

![Bet accepted by the platform](images/screens/web/betslip-accepted.webp)
