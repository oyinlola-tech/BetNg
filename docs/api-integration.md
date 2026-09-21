# API Integration

How the BETNG clients talk to the platform, and what a backend engineer needs to supply to connect them. The route-by-route checklist is [`frontend-api.md`](./frontend-api.md); this document covers the layers, configuration, errors and the contracts still awaiting confirmation.

## 1. Layers

```
UI component
  ↓ feature hook            apps/*/src/hooks (TanStack Query keys, stale times, invalidation)
  ↓ application service     apps/*/src/services (placeBet, session, bootstrap)
  ↓ data source interface   packages/ui-core/src/*DataSource.type.ts
  ↓ platform adapter        packages/ui-core/src/adapters          ← or packages/mock-data in development
  ↓ SDK                     packages/client-sdk (REST + realtime)
  ↓ public gateway          /api/v1/*
  ↓ backend services
```

Rules the code holds to:

- A component never calls `fetch`, never builds a URL and never imports `@betng/client-sdk` or `@betng/mock-data`.
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
| `VITE_DATA_SOURCE` | `mock` in development and test | `mock` or `platform`. **Ignored in `staging` and `production`, which always use the platform** |
| `VITE_FEATURE_FLAGS` | none | Build-time flag overrides, e.g. `walletEnabled=false,tvEnabled=true`. Platform configuration wins over these |
| `VITE_REQUEST_TIMEOUT_MS` | `10000` | Per-request timeout |
| `VITE_LOG_LEVEL` | `info` (`warn` when deployed) | `debug` · `info` · `warn` · `error` |
| `VITE_SITE_URL` | none | Public origin of the web app, for canonical and Open Graph URLs |

`readClientEnv` also returns `problems` (a malformed URL, plain HTTP in a deployed build, a mock requested in production); apps log them at start-up.

The mock is loaded with a dynamic `import()` behind the data-source mode, so a staging or production bundle does not contain it.

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

## 6. Contracts awaiting backend confirmation

Proposed shapes live in `packages/contracts/src/discovery/discovery.type.ts` with fixtures in `packages/contracts/tests/fixtures/wire.ts`. Until a route is served, the adapter answers an empty value and the screen shows its unavailable state.

| Need | Proposed contract | Used by |
| --- | --- | --- |
| Match clock | `clock: MatchClock { period, minute, addedMinutes?, asOf, minuteLengthMs? }` on `GET /matches`, `GET /matches/:id`, and on live frames. Without it the adapter reads period and minute from the platform's own events on a match page, and lists show `LIVE` without a minute | every live surface |
| Interrupted matches | `Match.status` values `POSTPONED`, `SUSPENDED`, `DELAYED` and `statusReason` | match cards |
| Lineups | `GET /matches/:id/lineups` → `MatchLineups` | match center |
| Head to head | `GET /matches/:id/head-to-head` → `HeadToHead` | match center |
| Search | `GET /search?q=&kinds=&limit=` → `SearchResponse` | global search |
| Public configuration | `GET /config` → `PublicConfig` (currency, features, stake limits, competition timezone, maintenance) | all apps |
| Paged transactions | `GET /wallets/:userId/transactions?page=&pageSize=&types=&statuses=&from=&to=&search=&sort=&direction=` → `Page<Transaction>`, with `status`, `description`, `betId` on each row. An unpaged `{ items }` answer is paged client-side as a stopgap | wallet, transactions |
| Bet acceptance detail | On `POST /bets`: honour `idempotency-key`; answer a smaller `stake` when limited; refuse with `STAKE_LIMITED { maxStake }`, `ODDS_CHANGED { current }`, `MARKET_CLOSED { selectionIds }`, `RISK_REJECTED`, `INSUFFICIENT_FUNDS` | bet slip |
| Team crest | optional `Team.crest { assetUrl?, shape?, pattern?, emblem?, accent? }`; without it clients draw the generated crest for the team id | every surface |
| Market presentation | optional `Market.name`, `Market.group`, `Market.suspensionReason`, `Selection.status` | markets |
| Realtime authentication and account channels | see [`realtime.md`](./realtime.md) | bets, wallet, notifications |
| Server-driven admin lists | `page`, `pageSize`, `sort`, `direction`, `search` and per-list filters on every admin list, answering `Page<T>` | admin |

## 7. Connecting a backend

1. Set `VITE_API_URL`, `VITE_WS_URL`, `VITE_APP_ENV` and, if needed, `VITE_REALTIME_TRANSPORT` / `VITE_REALTIME_AUTH` for each app.
2. Build. Staging and production builds use the platform adapter with no code change.
3. Serve the routes in `frontend-api.md`. Anything not yet served degrades to an empty or unavailable state rather than an error.
4. Run `pnpm test`: `packages/contracts/tests/wire.test.ts` fails if a schema drifts from the payloads the clients are built against.

## 8. GraphQL and RPC

REST is the contract today. Because screens depend only on the data-source interfaces, a read-heavy page can move to GraphQL by changing the adapter method behind it; no component changes. Clients never call RPC; it is a backend-to-backend concern behind the gateway.
