# Frontend → Platform API

Every public screen in web, mobile, TV, shop and admin reads matches, markets and tables through one interface, `BetNgDataSource` (`packages/ui-core/src/dataSource.type.ts`). Two implementations exist:

- `createPlatformDataSource` (`packages/ui-core/src/adapters/platformDataSource.ts`) — the real one. It calls the gateway through `@betng/client-sdk` and subscribes to the event service over WebSocket.
- `createMockDataSource` (`packages/mock-data`) — an in-process virtual season used until the routes below are served. Each mock method is annotated with the `@endpoint` it mirrors.

Switch an app with `VITE_DATA_SOURCE=platform` (web, TV) or `expo.extra.dataSource: "platform"` (mobile). No code changes.

All routes sit under `API_PREFIX = /api/v1`. Every response uses the envelope in `packages/contracts/src/common/envelope.type.ts`; list endpoints answer `{ items: T[] }`. Schemas referenced below live in `@betng/contracts`.

## Routes the frontend calls

| Method | Path                            | Query / body                                                                     | Response schema                                                                                                       | Owner                        | Status                                                                         |
| ------ | ------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------ |
| GET    | `/leagues`                      | —                                                                                | `League[]`                                                                                                            | match                        | served                                                                         |
| GET    | `/teams`                        | `leagueId?`                                                                      | `Team[]` — now with optional `city`, `stadium`, `colors`                                                              | match                        | served (new fields optional)                                                   |
| GET    | `/fixtures`                     | —                                                                                | `Fixture[]` — now with optional `season`                                                                              | match                        | served (new field optional)                                                    |
| GET    | `/matches`                      | `leagueId?`, `status?`                                                           | `Match[]`                                                                                                             | match                        | served                                                                         |
| GET    | `/matches/:id`                  | —                                                                                | `Match`                                                                                                               | match                        | served                                                                         |
| GET    | `/matches/:id/events`           | —                                                                                | `MatchEvent[]` (`matchEventSchema`, now incl. `CORNER`, `SECOND_HALF`, `player`, `secondaryPlayer`, `score`)          | match                        | **to implement**                                                               |
| GET    | `/matches/:id/stats`            | —                                                                                | `MatchStats` (`matchStatsSchema`)                                                                                     | match                        | **to implement**                                                               |
| GET    | `/matches/:id/odds`             | —                                                                                | `MatchOdds` — `marketTypeSchema` now includes `DOUBLE_CHANCE`, `CORRECT_SCORE`, `GOAL_SPREAD`; `Market.line` optional | odds                         | served (new kinds optional)                                                    |
| GET    | `/leagues/:id/standings`        | `season?`                                                                        | `Standings` (`standingsSchema`)                                                                                       | match                        | **to implement** (client computes from `/matches?status=COMPLETED` until then) |
| GET    | `/leagues/:id/scorers`          | `season?`                                                                        | `TopScorer[]` (`topScorerSchema`)                                                                                     | match                        | **to implement**                                                               |
| POST   | `/bets`                         | `PlaceBetRequest` — legs may carry `marketType`, `marketLabel`, `selectionLabel` | `Bet`                                                                                                                 | betting                      | served; persist the label fields                                               |
| GET    | `/bets`                         | `userId?`, `status?`                                                             | `Bet[]` — legs should carry `outcome`; bet should carry `payout`                                                      | betting                      | served; add `outcome`/`payout`                                                 |
| GET    | `/bets/:id`                     | —                                                                                | `Bet`                                                                                                                 | betting                      | served                                                                         |
| GET    | `/wallets/:userId`              | —                                                                                | `Wallet`                                                                                                              | wallet                       | served                                                                         |
| GET    | `/wallets/:userId/transactions` | —                                                                                | `Transaction[]`                                                                                                       | wallet                       | served                                                                         |
| POST   | `/wallets/deposit`              | `DepositRequest`                                                                 | `{ wallet, transaction }`                                                                                             | wallet                       | served                                                                         |
| POST   | `/wallets/withdraw`             | `WithdrawRequest`                                                                | `{ wallet, transaction }`                                                                                             | wallet                       | served                                                                         |
| GET    | `/users/:id/notifications`      | —                                                                                | `Notification[]` (`notificationSchema`)                                                                               | new: notification (or event) | **to implement**                                                               |
| POST   | `/users/:id/notifications/read` | `MarkNotificationsReadRequest`                                                   | `204`                                                                                                                 | same                         | **to implement**                                                               |

How the adapter treats a route that is not served yet: a `404`, `501` or `error.code = NOT_IMPLEMENTED` answer falls back to an empty value (`[]`, `undefined`) and the screen renders its empty state. Every other failure surfaces as a `DataSourceError` the screens present.

## Authentication, shop and admin routes

None of these are served by the gateway yet. The contracts (`packages/contracts/src/{auth,shop,admin}`), SDK clients (`packages/client-sdk/src/rest/{auth,shop,admin}Client.ts`) and platform adapters (`packages/ui-core/src/adapters/platformAccountSources.ts`) are complete, so serving a route is the only step left. Mocks live in `packages/mock-data/src/{auth,shop,admin}` behind the same interfaces (`AuthDataSource`, `ShopDataSource`, `AdminDataSource`).

Rules every route below follows:

- The session token travels as `Authorization: Bearer <token>`. `401` (or `error.code = UNAUTHENTICATED | SESSION_EXPIRED`) ends the client session and shows the session-expired state; `403` / `FORBIDDEN` shows permission denied; `409` / `CONFLICT` means the resource changed (ticket already paid, market already suspended); `429` / `RATE_LIMITED` is surfaced on login forms.
- Sessions carry `permissions: string[]` resolved by the platform from the role (`shopPermissionSchema`, `adminPermissionSchema`). Clients only hide or disable UI from it. **Every route must enforce the permission server-side.**
- Every mutating admin or shop route takes a human `reason` where listed and must write an audit entry.
- The admin surface has no route that sets a score or picks a winner. Match operations are limited to `matchAdminActionSchema`; results only ever come from the simulation service.

### Customer auth (`/auth`) — web and mobile

| Method | Path                    | Body                      | Response              | Notes                                                                 |
| ------ | ----------------------- | ------------------------- | --------------------- | --------------------------------------------------------------------- |
| POST   | `/auth/register`        | `CustomerRegisterRequest` | `RegistrationPending` | Sends a six-digit code; no session until verified                     |
| POST   | `/auth/verify`          | `VerifyEmailRequest`      | `CustomerSession`     |                                                                       |
| POST   | `/auth/verify/resend`   | `{ email }`               | `204`                 | Rate limited                                                          |
| POST   | `/auth/login`           | `CustomerLoginRequest`    | `CustomerSession`     | `401` on bad credentials; unverified accounts answer `CONFLICT`       |
| POST   | `/auth/logout`          | —                         | `204`                 |                                                                       |
| GET    | `/auth/me`              | —                         | `CustomerProfile`     |                                                                       |
| POST   | `/auth/password/forgot` | `PasswordResetRequest`    | `204`                 | Always `204`, whether or not the address exists                       |

Once these are served, `/bets`, `/wallets/*` and `/users/:id/notifications` should take the user from the token rather than the path or body.

### Shop terminal (`/shop`) — cashier session required

| Method | Path                          | Query / body                                      | Response            | Permission          |
| ------ | ----------------------------- | ------------------------------------------------- | ------------------- | ------------------- |
| POST   | `/shop/auth/login`            | `ShopLoginRequest` (shop code, username, password, optional PIN) | `ShopSession` | —            |
| POST   | `/shop/auth/logout`           | —                                                 | `204`               | —                   |
| GET    | `/shop/auth/session`          | —                                                 | `ShopSession`       | —                   |
| POST   | `/shop/tickets`               | `PlaceTicketRequest`                              | `Ticket`            | `tickets:sell`      |
| GET    | `/shop/tickets`               | `status?`, `q?` (code, customer, phone), `date?`  | `{ items: Ticket[] }` | `tickets:check`   |
| GET    | `/shop/tickets/:code`         | —                                                 | `Ticket`            | `tickets:check`     |
| POST   | `/shop/tickets/:code/payout`  | `PayoutTicketRequest` (cashier PIN)               | `Ticket` (`PAID`)   | `tickets:payout`    |
| POST   | `/shop/tickets/:code/cancel`  | `CancelTicketRequest`                             | `Ticket`            | `tickets:cancel`    |
| GET    | `/shop/transactions`          | `date?`                                           | `{ items: ShopTransaction[] }` | `transactions:read` |
| GET    | `/shop/reports/daily`         | `date?`                                           | `ShopDailyReport`   | `reports:read`      |
| GET    | `/shop/reports/daily/range`   | `from`, `to`                                      | `{ items: ShopDailyReport[] }` | `reports:read` |
| GET    | `/shop/cashiers`              | —                                                 | `{ items: Cashier[] }` | `cashiers:read`  |

Payout must be idempotent per ticket: a second attempt answers `409` with the ticket in `PAID`. A ticket is payable only in `WON`; `VOID` refunds the stake through the same route. Tickets from another shop answer `404`.

### Admin control plane (`/admin`) — admin session required

| Method | Path                                                  | Query / body                                  | Response                       | Permission           |
| ------ | ----------------------------------------------------- | --------------------------------------------- | ------------------------------ | -------------------- |
| POST   | `/admin/auth/login`                                   | `AdminLoginRequest` (TOTP `code` when 2FA on) | `AdminSession`                 | —                    |
| POST   | `/admin/auth/logout`                                  | —                                             | `204`                          | —                    |
| GET    | `/admin/auth/session`                                 | —                                             | `AdminSession`                 | —                    |
| GET    | `/admin/overview`                                     | —                                             | `PlatformOverview`             | any                  |
| GET    | `/admin/health/services`                              | —                                             | `{ items: ServiceHealth[] }`   | `health:read`        |
| GET    | `/admin/users`                                        | `q?`                                          | `{ items: AdminCustomer[] }`   | `users:read`         |
| POST   | `/admin/users/:id/status`                             | `{ status, reason }`                          | `AdminCustomer`                | `users:write`        |
| GET    | `/admin/shops`                                        | —                                             | `{ items: AdminShopSummary[] }`| `shops:read`         |
| GET    | `/admin/shops/:id`                                    | —                                             | `AdminShopSummary`             | `shops:read`         |
| POST   | `/admin/shops`                                        | `CreateShopRequest`                           | `AdminShopSummary`             | `shops:write`        |
| PATCH  | `/admin/shops/:id`                                    | partial `CreateShopRequest`                   | `AdminShopSummary`             | `shops:write`        |
| POST   | `/admin/shops/:id/status`                             | `{ status, reason }`                          | `AdminShopSummary`             | `shops:write`        |
| GET    | `/admin/shops/:id/cashiers`                           | —                                             | `{ items: AdminCashierSummary[] }` | `shops:read`     |
| POST   | `/admin/shops/:id/cashiers`                           | `CreateCashierRequest`                        | `CashierCredentials` (shown once) | `cashiers:write`  |
| POST   | `/admin/shops/:id/cashiers/:cashierId/status`         | `{ status, reason }`                          | `AdminCashierSummary`          | `cashiers:write`     |
| POST   | `/admin/shops/:id/cashiers/:cashierId/reset-credentials` | —                                          | `CashierCredentials` (shown once) | `cashiers:write`  |
| GET    | `/admin/teams`                                        | `leagueId?`                                   | `{ items: AdminTeam[] }`       | `catalogue:read`     |
| PATCH  | `/admin/teams/:id`                                    | `UpdateTeamRequest`                           | `AdminTeam`                    | `catalogue:write`    |
| GET    | `/admin/fixtures`                                     | `leagueId?`, `matchday?`, `matchStatus?`      | `{ items: AdminFixture[] }`    | `fixtures:read`      |
| GET    | `/admin/matches/:id`                                  | —                                             | `AdminFixture`                 | `fixtures:read`      |
| POST   | `/admin/matches/:id/actions`                          | `MatchAdminActionRequest`                     | `AdminFixture`                 | `fixtures:operate`   |
| GET    | `/admin/odds`                                         | `matchId?`                                    | `{ items: AdminMarketOdds[] }` | `odds:read`          |
| POST   | `/admin/markets/:id/actions`                          | `MarketAdminActionRequest`                    | `AdminMarketOdds`              | `odds:write`         |
| GET    | `/admin/risk/overview`                                | —                                             | `RiskOverview`                 | `risk:read`          |
| GET    | `/admin/simulations`                                  | `status?`                                     | `{ items: AdminSimulationRun[] }` | `simulation:read` |
| POST   | `/admin/simulations/:id/actions`                      | `{ action: RETRY \| CANCEL, reason }`         | `AdminSimulationRun`           | `simulation:operate` |
| GET    | `/admin/settlements`                                  | `status?`                                     | `{ items: AdminSettlement[] }` | `settlement:read`    |
| POST   | `/admin/settlements/:id/retry`                        | `{ reason }`                                  | `AdminSettlement`              | `settlement:operate` |
| GET    | `/admin/wallet/overview`                              | —                                             | `PlatformWalletOverview`       | `wallet:read`        |
| GET    | `/admin/reports/daily`                                | `from`, `to`                                  | `{ items: PlatformReportDay[] }` | `reports:read`     |
| GET    | `/admin/audit`                                        | `AuditLogQuery`                               | `Page<AuditLogEntry>`          | `audit:read`         |
| GET    | `/admin/settings`                                     | —                                             | `PlatformSettings`             | `settings:read`      |
| PATCH  | `/admin/settings`                                     | partial `PlatformSettings` + `reason`         | `PlatformSettings`             | `settings:write`     |

Live Control reads the public `/matches` routes and the `WS /live` stream; it needs no admin-only route. The audit log must redact secrets in `before`/`after` server-side (password hashes, PINs, tokens); the client shows what it is given.

## Live stream (`WS /live`)

Protocol in `packages/contracts/src/realtime/liveProtocol.type.ts`; client in `packages/client-sdk/src/live/liveClient.core.ts`.

- Client sends `SUBSCRIBE { channel: "match:<matchId>" }`; server answers `SUBSCRIBED { lastSequence }`.
- Server pushes `EVENT { channel, event: LiveEvent }` with a strictly increasing per-match `sequence` and the running `score`.
- The frontend never trusts the stream as the source of truth: it reads `GET /matches/:id` (+ `/events`, `/stats`) first, applies events whose `sequence` is exactly `last + 1`, and re-reads on a gap or after a reconnect (`packages/ui-core/src/live/watchMatch.ts`).
- Event `type` → UI kind mapping: `KICKOFF`/`MATCH_STARTED` → `KICK_OFF`, `MATCH_FINISHED` → `FULL_TIME`, all others 1:1.

## Match timing the clients assume

`packages/ui-core/src/timing.ts` (`VIRTUAL_TIMING`): 2 real seconds per match minute, a 15 s half-time, betting closes 10 s before kick-off, settlement 8 s after full time. The clock is derived from `Fixture.kickoffAt`, so the platform only has to schedule kick-offs on that cadence; nothing else has to be pushed for the clock to be right on every client.

## Presentation phases derived on the client

`MatchStatus` (contract) → `MatchPhase` (UI): `SCHEDULED`, `BETTING_OPEN`, `BETTING_CLOSED` map 1:1; `IN_PLAY` becomes `LIVE` or `HALFTIME` from the clock; `COMPLETED` becomes `FINISHED` then `SETTLED` after the settlement delay. See `packages/ui-core/src/phase.ts`.

## Simulated-money rule

Every amount is play-money in kobo. The UI labels wallet, stake and return values as simulated; the platform must never wire these routes to a payment provider.
