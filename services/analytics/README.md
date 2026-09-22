# betng-analytics

Read-only global bet analysis and reports for BetNG, a portfolio simulation that uses play money. Python / FastAPI, port 3009.

The service owns no schema and writes nothing. Its login (`betng_analytics`) holds `SELECT` on every schema and no other privilege, and the service additionally opens every connection with `default_transaction_read_only=on`.

## Principles

- Every figure is a SQL aggregate over database rows. Nothing is mocked, hard-coded or sampled; a read that fails answers `DATABASE_UNAVAILABLE` (503). The one thing remembered is the daily summary below, and only for days whose figures can no longer change.
- The population is **every accepted bet**: every customer, every shop, every cashier. A row exists in `betting.bets` only for an accepted bet. A scope (window, league, match, shop, customer, cashier) narrows that population; the caller's identity never does.
- Customer, shop and cashier analyses are *views over the same global bets*. Their shares add up to the global totals. Nothing here implies separate games, matches or prices.
- Money is integer kobo (`bigint` in SQL, `int` in Python). Rates are computed with `Decimal`, rounded half-even to 6 places, and serialised as numbers.
- A request that needs several statements runs them in one `REPEATABLE READ` read-only transaction, so one answer describes one instant of the book.
- Analytics reads bets *about* matches. Nothing it computes is an input to a match, a price or a result.
- Result secrecy: a score or result is answered only for a match whose `match.matches.status` is `COMPLETED`. The join to `simulation.match_results` carries that condition, the handler checks the status again, and a bet leg's `result` is nulled for any other status.

## Formulas

A window is half-open over `betting.bets.placed_at`: `from <= placed_at < to`. Either bound may be absent.

| Figure | Definition |
| --- | --- |
| `totalBets`, `acceptedBets` | `COUNT(betting.bets)` in the window |
| `limitedBets` / `rejectedBets` | `COUNT(risk.risk_decisions)` with `decision = 'LIMIT'` / `'REJECT'` and `created_at` in the window |
| `pendingBets` / `winningBets` / `losingBets` / `voidBets` / `cancelledBets` | `COUNT(*)` by `bets.status` = `PENDING` / `WON` / `LOST` / `VOID` / `CANCELLED` |
| `settledBets` | `winningBets + losingBets + voidBets` |
| `totalStake` | `SUM(stake) WHERE status <> 'CANCELLED'` |
| `pendingStake` | `SUM(stake) WHERE status = 'PENDING'` |
| `settledStake` | `SUM(stake) WHERE status IN ('WON','LOST')` |
| `totalPayout` | `SUM(payout) WHERE status = 'WON'` — realised payouts only. A pending bet's potential payout never counts, and a void bet's refund is not a payout |
| `operatorResult` | `settledStake − totalPayout`. `VOID` and `CANCELLED` are excluded on both sides: the stake went back. May be negative and is reported as it is |
| `operatorResultRate` | `operatorResult / settledStake`, `0` when `settledStake = 0` |
| exposure / `pendingLiability` | `SUM(potential_payout − stake)` over `PENDING` bets |
| `totalMatches` | `COUNT(DISTINCT bet_selections.match_id)` over the legs of the bets in scope |
| `customers` / `shops` / `cashiers` | `COUNT(DISTINCT user_id / shop_id / cashier_id)` over the bets in scope |

### Reconciliation (`GET /internal/analytics/operator`)

For the bets placed in the window, the same five figures (`settledBets` = won + lost, `voidBets`, `grossStakes`, `grossPayouts`, `refundedStakes` = void stakes) are summed from three independent sources:

1. `bets` — `betting.bets` by `status`;
2. `settlements` — the latest `revision` per bet in `settlement.settlements`, by `outcome`;
3. `ledger` — `settlement.operator_ledger_entries` joined to those settlements.

`reconciled` is `true` only when all three agree on every figure. `summary` is an `OperatorSummary` built from source 1, with a `CUSTOM`, `OPEN` period (`startsAt` = `from`, else the earliest `placed_at` in scope).

### Breakdown

`by = league | match | market | selection | shop | cashier | customer | channel | hour | day`. Each row carries the figures above for the bets under its key; `stake` is `totalStake`, `payout` is `totalPayout`.

The dimension, its SQL key, its sort order and the bucket size come from a fixed table in `repositories/analytics_sql.py`. No identifier is ever built from input; every caller value is a bound parameter.

| `by` | key | label |
| --- | --- | --- |
| `league` | `bet_selections.league_id` | `league_name` |
| `match` | `match_id` | `match_label` |
| `market` | `market_type[:line]`, e.g. `OVER_UNDER:2.5` | `market_label` |
| `selection` | `market_type[:line]:selection_code` | `market_label - selection_label` when it is the same for every leg, else the key |
| `shop` / `cashier` / `customer` | the id, or `none` | `identity` name; `none` is "No shop (online)", "No cashier (online)", "Walk-in (shop ticket)" |
| `channel` | `ONLINE` / `SHOP` | the same |
| `hour` / `day` | `YYYY-MM-DDTHH:00` / `YYYY-MM-DD` in the report time zone | the same |

Bet-level dimensions (`shop`, `cashier`, `customer`, `channel`, `hour`, `day`) partition the bets, so they always sum back to the overview. Leg-level dimensions (`league`, `match`, `market`, `selection`) count a bet once under *each* key it has a leg on: singles sum back to the overview exactly, and a multiple spanning two keys appears under both. Within one key a bet is never counted twice.

Rows are ordered by stake (time dimensions by key) and capped by `limit` (default 100, max 500).

### Sessions

A session is an analysis period over the same global bets. `customers`, `shops`, `cashiers` are distinct counts over its bets; `markets` and `matches` are distinct counts over its legs.

| kind | grouping | `sessionId` | `startsAt` … `endsAt` |
| --- | --- | --- | --- |
| `HOUR` | `date_trunc('hour', placed_at)` in the report zone | `SESSION-20260921-0015` (day, then hour of day counted from one) | the hour |
| `DAY` | `date_trunc('day', placed_at)` in the report zone | `SESSION-20260921` | the day |
| `MATCHDAY` | league + season + matchday of the bet's legs (`match.fixtures`) | `SESSION-<leagueCode>-S1-MD07` | first … last kick-off of that matchday's fixtures |
| `ROUND` | the same grouping | `SESSION-<leagueCode>-S1-R07` | the same |
| `CUSTOM` | the whole window, one row | `SESSION-20260901T0000Z-20260921T0000Z` | `from` … `to`, defaulting to the first and last `placed_at` in scope |

### Account, shop and cashier views

`bets`, `pendingBets`, `wins`, `losses`, `voids`, `stake` as above over the subject's bets (`user_id`, `shop_id` or `cashier_id` equals the subject). `operatorContribution = settledStake − payout(WON)` over those bets and `netResult = −operatorContribution`.

- **Customer**: `transactions = COUNT(wallet.wallet_transactions)` of the customer's wallet account.
- **Shop**: `commission = SUM(settlement.commission_ledger.shop_share_amount)`; `transactions = COUNT(wallet.wallet_transactions)` of the shop's float account (`owner_type = 'SHOP'`).
- **Cashier**: `bets` = tickets accepted, `stake` = stake processed, `payout` = payout processed = `SUM(bets.payout)` over tickets with `tickets.paid_by` = the cashier. A cashier may pay a ticket another cashier sold, so `payout` is *not* the payout on the tickets they accepted; `operatorContribution` and `netResult` are always about the tickets they accepted.

An optional window applies to `placed_at` for the bets, `created_at` for wallet transactions and commission rows, and `paid_at` for processed payouts. An unknown subject is `NOT_FOUND`.

### Platform overview and daily report

"Today" and calendar days are cut in `ANALYTICS_REPORT_TIMEZONE` (default `UTC`).

- `activeUsers` = customers with `status = 'ACTIVE'` and `last_active_at` within the last 15 minutes.
- `activeShops` = `COUNT(DISTINCT shop_id)` over bets placed today (shops trading today).
- `openBets` = `COUNT(bets) WHERE status = 'PENDING'`; `liveMatches` = `COUNT(match.matches) WHERE status = 'IN_PLAY'`.
- `todayStake` / `todayPayouts` / `todayNet` = `totalStake` / `totalPayout` / `operatorResult` of the bets placed today.
- A `PlatformReportDay` is the same for the bets placed on that day: `stake`, `payouts`, `net = settledStake − payouts`, `bets`, and `onlineStake` / `shopStake` = `totalStake` by channel. `net` is therefore not `stake − payouts` while bets are pending or void. Every day of the range is answered, including days with no bets. A range defaults to the 7 days ending today and may span at most 366 days.

### Daily summary

The login cannot write, so the summary lives in the process. Every `ANALYTICS_SUMMARY_REFRESH_SECONDS` a job reads the daily figures of the last 366 days in one statement and seals a day once it ended over an hour ago and none of its bets is `PENDING`. A bet leaves `PENDING` once and is never placed in the past, so a sealed day is final. The daily report answers sealed days from the summary and reads every other day (today, and any day still holding a pending bet) with the raw query; `tests/test_summary_and_export.py` checks both give the same rows. The platform overview is today only and never sealed; windowed overviews count distinct customers, shops and matches, which do not add across days, so neither uses the summary.

### Export

`GET /api/v1/admin/reports/export?format=csv&report=daily|bets|audit&from&to[&status&channel]` streams a CSV attachment. `from`/`to` are days as for the daily report (at most 366). `bets` and `audit` are read in keyset pages of 1,000 and refused with 422 above 100,000 rows. `audit` reads `identity.audit_logs` and also needs `audit:read`. A text cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return is prefixed with `'`. Only CSV is produced; xlsx and PDF would need a new dependency.

### Shop daily report

A till view of one shop, always the calling cashier's (`x-betng-shop-id`); a shop id in the query is ignored.

- `ticketsSold` = tickets created that day (cancelled ones included, as `totalBets` includes them); `sales` = `SUM(stake)` of those whose bet is not `CANCELLED`; `openTickets` = those whose bet is still `PENDING`.
- `payouts` = `SUM(bets.payout)` over tickets with `paid_at` on that day; `cancellations` = tickets whose bet has `cancelled_at` on that day.
- `net = sales − payouts`: cash taken minus cash paid over the counter that day. This is a till figure, not the operator result.
- `byCashier`: sales by selling cashier, payouts by paying cashier (`paid_by`). `byLeague`: tickets and sales by the leagues of their legs (a multiple counts under each league it touches).

## Routes

Internal (not proxied; requires the internal service token, otherwise `404`):

| Route | Answer |
| --- | --- |
| `GET /internal/analytics/overview?from&to` | `AnalyticsOverview` |
| `GET /internal/analytics/bets?from&to&status&channel&shopId&userId&matchId&page&pageSize` | `Page<bet with legs>` |
| `GET /internal/analytics/matches/{matchId}` | match header, `overview`, `byMarket`, `bySelection` (keyed by market / selection id), `result` once `COMPLETED` |
| `GET /internal/analytics/exposure?leagueId&matchId&shopId&limit` | pending liability by match → market → selection, plus totals |
| `GET /internal/analytics/operator?from&to` | live `OperatorSummary` and the three-way reconciliation |

Gateway-proxied, same path here. `401 UNAUTHENTICATED` without an actor, `403 FORBIDDEN` for the wrong kind or a missing permission; the actor is checked before the query string is validated.

| Route | Actor | Permission |
| --- | --- | --- |
| `GET /api/v1/admin/overview` | ADMIN | — |
| `GET /api/v1/admin/reports/daily?from&to` | ADMIN | `reports:read` |
| `GET /api/v1/admin/reports/export?format=csv&report&from&to` | ADMIN | `reports:read` (`audit:read` too for `audit`) |
| `GET /api/v1/admin/analytics/overview?from&to` | ADMIN | `reports:read` |
| `GET /api/v1/admin/analytics/breakdown?by&from&to&leagueId&matchId&shopId&limit` | ADMIN | `reports:read` |
| `GET /api/v1/admin/analytics/sessions?kind&from&to&leagueId&limit` | ADMIN | `reports:read` |
| `GET /api/v1/admin/analytics/matches/{id}` | ADMIN | `reports:read` |
| `GET /api/v1/admin/analytics/accounts/{customerId}?from&to` | ADMIN | `reports:read` |
| `GET /api/v1/admin/analytics/shops/{shopId}?from&to` | ADMIN | `reports:read` |
| `GET /api/v1/admin/analytics/cashiers/{cashierId}?from&to` | ADMIN | `reports:read` |
| `GET /api/v1/shop/reports/daily?date` | CASHIER with a shop | `reports:read` |
| `GET /api/v1/shop/reports/daily/range?from&to` | CASHIER with a shop | `reports:read` |

`/health` is liveness; `/ready` runs a query against PostgreSQL.

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `ANALYTICS_DATABASE_URL` | — (required) | the `betng_analytics` login |
| `ANALYTICS_PORT` | `3009` | |
| `ANALYTICS_REPORT_TIMEZONE` | `UTC` | IANA zone for days and hours |
| `ANALYTICS_SUMMARY_REFRESH_SECONDS` | `300` | daily summary refresh; `0` turns it off |
| `INTERNAL_SERVICE_TOKEN` | — | shared kit: gates actor headers and `/internal` |

## Development

```bash
python3 -m venv .venv && .venv/bin/pip install -e ../shared -e '.[dev]'
.venv/bin/ruff check . && .venv/bin/ruff format --check . && .venv/bin/mypy
.venv/bin/python -m pytest -q
```

The tests use the dedicated database `betng_test_analytics`. As the superuser they create every table analytics reads with the columns of the shared read model (docs/architecture.md §8) and insert their rows into a random hour of the twentieth century, which they delete afterwards; the service under test connects as `betng_analytics`.

## Proof

Recorded on 2026-09-21. Screenshots are the apps running against the real platform; terminal images are real command output rendered by `scripts/docs/render-terminal.mjs`, and design sheets are rendered from the packages themselves by `scripts/docs/render-design-sheets.mjs`.

![Python suites: analytics 120 tests](../../docs/images/proof/backend-python-tests.webp)

![Platform scenario, step 18 reconciles analytics](../../docs/images/proof/backend-e2e-scenario.webp)

<table>
  <tr><td width="50%"><img alt="Admin dashboard" src="../../docs/images/screens/admin/dashboard-light.webp"><br><sub>Overview in the admin console</sub></td><td width="50%"><img alt="Admin reports" src="../../docs/images/screens/admin/reports.webp"><br><sub>Breakdowns in the admin console</sub></td></tr>
</table>
