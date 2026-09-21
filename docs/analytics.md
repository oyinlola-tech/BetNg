# BetNG analytics: what every number means

Every figure the admin and shop reports show is computed by the analytics service (`services/analytics`) from database rows, using the definitions below. Routes and configuration are in `services/analytics/README.md`.

## Principles

- Every figure is a SQL aggregate over database rows. Nothing is mocked, hard-coded, sampled, cached or remembered; a read that fails answers `DATABASE_UNAVAILABLE` (503).
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

### Shop daily report

A till view of one shop, always the calling cashier's (`x-betng-shop-id`); a shop id in the query is ignored.

- `ticketsSold` = tickets created that day (cancelled ones included, as `totalBets` includes them); `sales` = `SUM(stake)` of those whose bet is not `CANCELLED`; `openTickets` = those whose bet is still `PENDING`.
- `payouts` = `SUM(bets.payout)` over tickets with `paid_at` on that day; `cancellations` = tickets whose bet has `cancelled_at` on that day.
- `net = sales − payouts`: cash taken minus cash paid over the counter that day. This is a till figure, not the operator result.
- `byCashier`: sales by selling cashier, payouts by paying cashier (`paid_by`). `byLeague`: tickets and sales by the leagues of their legs (a multiple counts under each league it touches).
