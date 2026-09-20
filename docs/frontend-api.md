# Frontend → Platform API

Every screen in web, mobile and TV reads through one interface, `BetNgDataSource` (`packages/ui-core/src/dataSource.type.ts`). Two implementations exist:

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
