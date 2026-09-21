# BetNG platform architecture

BetNG is a portfolio simulation of a virtual-football platform. Every amount is play money in kobo. Nothing here is, or may be wired to, real-money wagering or a payment provider.

This document is the contract between services. Shapes referenced as `Name` are schemas in `packages/contracts`; Python services mirror them with Pydantic models that serialise to the same camelCase JSON.

## 1. Invariants

1. One match has one authoritative result.
2. All accounts consume the same match: fixtures, markets, odds, state, result and events are global rows keyed by one immutable `match_id` (UUID). Nothing is generated per user, per session, per shop or per request.
3. Bets never determine match results. The simulation receives teams, model version, configuration version and the match id. It has no access path to stakes, bettors, shops or exposure, and its database login is never used to read the `betting`, `wallet`, `risk` or `settlement` schemas.
4. Risk controls exposure before betting closes: it accepts, limits or rejects a stake. It cannot touch a price, a match or a result.
5. The simulation is independent of bettor identity.
6. Winning gap is derived from the result (`abs(home_goals - away_goals)`); it is never an input.
7. Settlement pays on the odds stored on the bet at acceptance (`bet_selections.odds`, `odds_version`), never on current odds.
8. PostgreSQL is authoritative. Redis holds locks, caches and rate-limit counters only.
9. The operator ledger is separate from customer wallets. Admin users are not customers, have no wallet and cannot place bets. A negative operator result is recorded as negative; no wallet absorbs it.
10. Analytics aggregate every accepted bet, from database rows, with documented formulas.
11. Settlement is idempotent: one settlement per bet, enforced by a unique key.
12. A match result is immutable once committed (database triggers reject UPDATE and DELETE). The only remedy for a bad match is voiding it, which refunds stakes and is audited.
13. Admin cannot pick a winner. No route sets a score, forces an outcome or re-simulates a match that has a result.
14. Frontends never generate authoritative state. They display what the API returns.

## 2. Topology

| Service    | Language        | Port | Owns schema  | Role                                                                 |
| ---------- | --------------- | ---- | ------------ | -------------------------------------------------------------------- |
| gateway    | TS / ZudoJS     | 3000 | —            | Public API surface, authentication, RBAC, rate limiting, proxying    |
| match      | TS / ZudoJS     | 3001 | `match`      | Catalogue, fixtures, match lifecycle, the scheduler                  |
| betting    | TS / ZudoJS     | 3002 | `betting`    | Bet and shop-ticket acceptance                                       |
| wallet     | TS / ZudoJS     | 3003 | `wallet`     | Customer wallets and shop floats; append-only ledger                 |
| settlement | TS / ZudoJS     | 3004 | `settlement` | Settlement, operator ledger, commission ledger, periods              |
| simulation | Python/FastAPI  | 3005 | `simulation` | Probability model, result and event generation                       |
| odds       | Python/FastAPI  | 3006 | `odds`       | Markets, pricing, odds snapshots                                     |
| risk       | Python/FastAPI  | 3007 | `risk`       | Stake decisions from global exposure; limits                         |
| event      | TS / ZudoJS     | 3008 | —            | WebSocket fan-out (`WS /live`)                                       |
| analytics  | Python/FastAPI  | 3009 | — (read-only)| Global bet analysis, reports                                         |
| identity   | TS / ZudoJS     | 3010 | `identity`   | Customers, admins, shops, cashiers, sessions, RBAC, audit, settings  |

Clients (web, mobile, TV, shop, admin) talk only to the gateway and to `WS /live`.

## 3. Database

One database, `betng` (`infrastructure/postgres/bootstrap.sql`, `pnpm db:bootstrap`). One schema and one login per owning service. **A service writes only its own schema and may read any schema** (`betng_reader` is granted to every service login). Cross-service *writes* always go through the owner's RPC.

- TS services use Prisma 7 with `@prisma/adapter-pg`. The URL carries `?schema=<name>`; the client is built with `new PrismaPg({ connectionString }, { schema })`. Cross-schema reads use `$queryRaw` with schema-qualified names.
- Python services use `psycopg` 3 through `betng_service_kit.database` (`create_pool`, `apply_migrations`, `database_probe`). Migrations are `migrations/NNN_name.sql` in the service, applied at startup, recorded in `<schema>.schema_migrations`. SQL is schema-qualified.
- `betng_test` is an identical database for integration tests (`bash scripts/db-bootstrap.sh betng_test`).

Money is `BIGINT` kobo. Odds are `NUMERIC(8,2)`. Probabilities are `NUMERIC(9,6)`. No float column holds money.

Payout arithmetic is integer-only: with each leg's odds as integer hundredths `h_i`, `potential_payout = floor(stake * Π h_i / 100^n)`; `total_odds = Π h_i / 100^n` rounded down to 2 dp for display.

## 4. Wire conventions

- Gateway-exposed REST lives under `/api/v1` and an upstream serves a route at **the same path** the gateway exposes. Internal REST lives under `/internal/...` and is never proxied. RPC is `POST /rpc` (wire format of `@zudojs/rpc`, mirrored by `betng_service_kit.rpc`).
- JSON is camelCase. Lists answer `{ "items": [...] }`. Errors answer `{ "error": { "code", "message", "requestId", "details"?, "data"? } }`: `details` lists field issues, `data` carries machine-readable context for a domain error (a TS service throws an `HttpError` whose `details` is a plain object and the shared error handler emits it as `data`).
- Error codes (HTTP): `VALIDATION_FAILED` 422, `UNAUTHENTICATED` 401, `SESSION_EXPIRED` 401, `INVALID_CREDENTIALS` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `RATE_LIMITED` 429, `MARKET_CLOSED` 409, `ODDS_CHANGED` 409 (`error.data.current`: `{selectionId, odds, oddsVersion}[]`), `STAKE_LIMITED` 409 (`error.data.maxStake`), `RISK_REJECTED` 409, `INSUFFICIENT_FUNDS` 422, `INVALID_BET` 422, `DUPLICATE_SIMULATION` 409, `DUPLICATE_SETTLEMENT` 409, `RESULT_IMMUTABLE` 409, `SIMULATION_FAILED` 502, `SETTLEMENT_FAILED` 502, `ODDS_UNAVAILABLE` 503, `RISK_UNAVAILABLE` 503, `DATABASE_UNAVAILABLE` 503, `UPSTREAM_UNAVAILABLE` 503. A failed operation is never reported as success.
- **Actor headers.** The gateway resolves `Authorization: Bearer <token>` with identity, strips any inbound `x-betng-*` header, and forwards: `x-betng-actor-kind` (`CUSTOMER` | `CASHIER` | `ADMIN`), `x-betng-actor-id`, `x-betng-actor-role`, `x-betng-actor-name`, `x-betng-shop-id` (cashiers), `x-betng-permissions` (comma list). Services read them with `readActor` (`@betng/service-kit`) / `read_actor` (`betng_service_kit`) and re-check the permission they need. A service never trusts a user id from a path or body over the actor.
- **Internal trust.** `POST /rpc` and the actor headers are honoured only when the request carries `x-betng-internal-token` equal to `INTERNAL_SERVICE_TOKEN` (constant-time compare). The gateway and every service-to-service client attach it; both kits do this automatically. Production refuses to start without a token, with a short one, or with the `.env.example` placeholder. Unset in development/test means no check.
- Structured logs (one JSON object per line) carry `timestamp`, `service`, `level`, `requestId`, and where relevant `matchId`, `betId`, `simulationId`, `event`. Never credentials, tokens, PINs or hashes.
- `/health` is liveness. `/ready` probes the real dependencies (database query, Redis ping, required peers).

## 5. Match lifecycle

`match.matches.lifecycle` holds the canonical state; `status` is the public projection.

| lifecycle              | public `status`  | entered when                                                        |
| ---------------------- | ---------------- | ------------------------------------------------------------------- |
| `FIXTURE_CREATED`      | `SCHEDULED`      | scheduler (or admin) creates fixture + match                         |
| `MARKETS_CREATED`      | `SCHEDULED`      | `odds.publishMarkets` created markets                               |
| `ODDS_PUBLISHED`       | `SCHEDULED`      | first odds snapshot (version 1) stored                              |
| `BETTING_OPEN`         | `BETTING_OPEN`   | markets open                                                        |
| `BETTING_ACTIVE`       | `BETTING_OPEN`   | first bet accepted (set by the scheduler from `betting` rows)        |
| `BETTING_CLOSED`       | `BETTING_CLOSED` | `betting_closes_at` reached; markets closed; exposure frozen        |
| `SIMULATION_STARTED`   | `BETTING_CLOSED` | `kickoff_at` reached; `simulation.runMatch` called                  |
| `RESULT_GENERATED`     | `IN_PLAY`        | result committed (not yet revealed)                                 |
| `EVENTS_PUBLISHED`     | `IN_PLAY`        | timeline committed; events are revealed as wall-clock reaches them  |
| `MATCH_FINISHED`       | `COMPLETED`      | full-time instant reached; final score copied to the match row      |
| `SETTLEMENT_STARTED`   | `COMPLETED`      | `settlement.settleMatch` called                                     |
| `SETTLEMENT_COMPLETED` | `COMPLETED`      | every accepted bet on the match has a settlement                    |
| `SIMULATION_FAILED`    | `BETTING_CLOSED` | run failed; retried with backoff, then left for an admin retry       |
| `SETTLEMENT_FAILED`    | `COMPLETED`      | settle failed; retried with backoff                                 |
| `VOIDED`               | `CANCELLED`      | admin voided the match; bets refunded                               |

Every transition is a row in `match.match_transitions` (`match_id, from_state, to_state, at, actor, reason`).

**Timing** (env, defaults match `packages/ui-core/src/timing.ts`): `MATCH_SECONDS_PER_MINUTE=2`, `MATCH_HALF_TIME_SECONDS=15`, `BETTING_CLOSE_LEAD_SECONDS=10`, `ROUND_CYCLE_SECONDS=240`, leagues staggered by `LEAGUE_STAGGER_SECONDS=60`, `UPCOMING_ROUNDS=3`. Minute `m` of the first half is revealed at `kickoff + m*spm`; second-half minute at `kickoff + 45*spm + half_time + (m-45)*spm`; full time at `kickoff + 90*spm + half_time`.

**Result secrecy.** The result exists from kick-off but is revealed over the match. Public routes return only events whose reveal instant has passed and the score implied by them. No gateway-exposed route, admin included, returns a score, result or unrevealed event for a match that is not `COMPLETED`.

**Scheduler** (match service, one tick per second, guarded by a Redis lock `lock:match:scheduler` so only one instance ticks): ensure upcoming rounds → publish markets → open → close → simulate → reveal events (RPC `event.publish`, update running score) → finish → settle. Failures set the `*_FAILED` lifecycle and retry with backoff; nothing is marked done that did not happen.

## 6. RPC procedures

All payloads are validated by the callee. `requestId` travels in RPC metadata.

| Procedure | Caller → callee | Payload → result |
| --- | --- | --- |
| `identity.authenticate` | gateway → identity | `{ token }` → `{ kind, id, role, name, shopId?, permissions[], expiresAt }`; `UNAUTHENTICATED`/`SESSION_EXPIRED` otherwise |
| `identity.verifyCashierPin` | betting → identity | `{ cashierId, pin }` → `{ valid }` |
| `identity.recordAudit` | any → identity | `{ actorId, actorRole, action, entityType, entityId, before?, after?, reason?, severity?, requestId }` → `{ id }` |
| `simulation.calculateProbabilities` | odds → simulation | `{ home: TeamStrength, away: TeamStrength }` → `{ homeXg, awayXg, maxGoals, scoreMatrix: number[][], modelVersion, configurationVersion }` (`scoreMatrix[h][a]`, sums to 1) |
| `simulation.runMatch` | match → simulation | `{ matchId, home: { teamId, name, shortName, strength: TeamStrength }, away: {…} }` → `{ simulationId, matchId, status, duplicate, modelVersion, configurationVersion, seed, result: { homeGoals, awayGoals, winner, winningGap }, eventCount }`. Second call for the same match returns the stored run with `duplicate: true`; it never re-simulates |
| `odds.publishMarkets` | match → odds | `{ matchId, home: TeamStrength, away: TeamStrength }` → `{ matchId, markets: number, oddsVersion }` (idempotent) |
| `odds.setMatchMarketsStatus` | match → odds | `{ matchId, status: "OPEN" \| "CLOSED" \| "SETTLED" \| "VOID" }` → `{ updated }` |
| `risk.evaluate` | betting → risk | `{ actor: { kind, id, shopId? }, stake, legs: [{ matchId, marketId, selectionId, odds }] }` → `RiskDecision` `{ decisionId, decision: "ACCEPT"\|"LIMIT"\|"REJECT", reason, maxStake }` |
| `risk.freezeExposure` | match → risk | `{ matchId }` → `{ matchId, frozenAt }` (stores the exposure snapshot at close) |
| `wallet.debit` / `wallet.credit` | betting, settlement → wallet | `{ ownerType: "CUSTOMER"\|"SHOP", ownerId, amount, type, idempotencyKey, reference?, note?, actorId? }` → `{ wallet, transaction, duplicate }`; `INSUFFICIENT_FUNDS` on overdraft |
| `betting.applySettlement` | settlement → betting | `{ betId, outcome: "WON"\|"LOST"\|"VOID", payout, legs: [{ selectionId, outcome, result }], settledAt }` → `{ betId, status }` (idempotent) |
| `settlement.settleMatch` | match → settlement | `{ matchId }` → `{ matchId, status, betsTotal, betsSettled, duplicate }` |
| `settlement.voidMatch` | match → settlement | `{ matchId, reason }` → same shape |
| `event.publish` | match, odds → event | `{ matchId, type, minute, side?, score, description }` → `{ sequence }` |

`TeamStrength` = `{ attack, defence, midfield, goalkeeping, pace, finishing, possession, form, homeAdvantage }`; ratings 0–100, `form` −10…+10.

## 7. Services

### match (`match` schema)
Tables: `leagues` (+`slug`, `sport`, `status`), `teams` (+`city`, `stadium`, colours, the nine strength columns), `fixtures` (+`season`), `matches` (+`lifecycle`, per-state timestamps, running score, `revealed_sequence`, failure fields), `match_transitions`.
Public: `GET /leagues`, `/teams`, `/fixtures`, `/matches` (`leagueId?`, `status?`, `matchday?`, `season?`, `from?`, `to?`, `limit?`; default window kick-off within −30 min … +30 min), `/matches/:id`, `/matches/:id/events`, `/matches/:id/stats`, `/results` (`leagueId?`, `limit?`; completed matches with `result: { homeGoals, awayGoals, winner, winningGap }`), `/leagues/:id/standings`, `/leagues/:id/scorers`.
Admin: `GET/POST /admin/leagues`, `GET/POST /admin/teams`, `PATCH /admin/teams/:id`, `GET/POST /admin/fixtures`, `GET /admin/matches/:id`, `POST /admin/matches/:id/actions` (`OPEN_BETTING`, `CLOSE_BETTING`, `START_SIMULATION` and `RERUN_SIMULATION` only when no result exists — otherwise `RESULT_IMMUTABLE` — and `VOID_MATCH`).

### simulation (`simulation` schema)
Tables: `model_configurations` (versioned parameters, one active), `simulation_runs`, `match_results` (immutable), `match_events` (immutable), all keyed by `match_id`. A unique index on `simulation_runs(match_id)` for non-failed runs is the lock: the run row, the result and the events commit in one transaction, so a concurrent second worker blocks on the index and then reads the committed run.
Seed: `seed = sha256(f"{match_id}:{model_version}:{configuration_version}")`; the PRNG is seeded from it, so the same three inputs reproduce the same result and timeline.
Internal: `POST /internal/simulation/matches/{id}/run`, `GET /internal/simulation/matches/{id}`, `GET /internal/simulation/matches/{id}/events`. Admin: `GET /admin/simulations`, `POST /admin/simulations/:id/actions`, `GET/PUT /admin/simulation/config`.

### odds (`odds` schema)
Tables: `pricing_configurations` (margin per market type, odds bounds; versioned), `markets`, `market_selections`, `odds_snapshots` (immutable, unique per `market_id, odds_version`).
Pipeline: score matrix (from simulation) → market probabilities → margin → odds (2 dp, bounded) → snapshot → database. Odds are market-level: every reader gets the same `oddsVersion` for the same market state.
Public: `GET /matches/:id/odds` → `MatchOdds`; `GET /odds?matchIds=a,b,c` → `{ items: MatchOdds[] }`. Admin: `GET /admin/odds`, `POST /admin/markets/:id/actions`, `GET/PUT /admin/odds/config`.

### risk (`risk` schema)
Tables: `risk_limits` (versioned), `risk_decisions` (every evaluation), `exposure_freezes`.
Exposure is global: computed from every `PENDING` row in `betting.bets`/`betting.bet_selections`, never per user. Selection liability = Σ(`potential_payout − stake`) over pending bets with a leg on that selection.
Internal: `POST /internal/risk/evaluate`, `GET /internal/risk/matches/{id}/exposure`. Admin: `GET /admin/risk/overview`, `GET /admin/risk/exposure`, `GET/PUT /admin/risk/limits`.

### betting (`betting` schema)
Tables: `bets` (+`channel` `ONLINE`|`SHOP`, `shop_id`, `cashier_id`, `risk_decision_id`, `payout`, status `PENDING|WON|LOST|VOID|CANCELLED`), `bet_selections` (accepted `odds`, `odds_version`, market/selection codes and labels, `line`, match label, league, kick-off, `outcome`, `result`), `tickets` (1:1 with a shop bet: `code`, shop, cashier, customer name/phone, `paid_at`, `paid_by`, `expires_at`, `cancel_reason`).
Placement: validate → per-match Redis lock → load match, market, selection and price by cross-schema read → match `BETTING_OPEN`/`BETTING_ACTIVE`, before `betting_closes_at`, market `OPEN` → submitted odds must equal current odds else `ODDS_CHANGED` → `risk.evaluate` (fail closed: `RISK_UNAVAILABLE`) → `wallet.debit` (customer wallet, or shop float for a ticket) → insert bet + legs in one transaction (refund on failure). The stored odds, version and payout are the server's, never the client's.
Routes: `POST/GET /bets`, `GET /bets/:id`; `POST/GET /shop/tickets`, `GET /shop/tickets/:code`, `POST /shop/tickets/:code/payout`, `POST /shop/tickets/:code/cancel`.

### wallet (`wallet` schema)
Tables: `wallet_accounts` (`owner_type` `CUSTOMER`|`SHOP`, `owner_id`), `wallet_transactions` (append-only, idempotency key per account). An account is opened on first access for an owner that exists in `identity` (customers get `WELCOME_GRANT_KOBO`, shops `SHOP_OPENING_FLOAT_KOBO`). There is no `ADMIN` owner type.
Routes: `GET /wallets/:userId`, `/wallets/:userId/transactions`, `POST /wallets/deposit`, `/wallets/withdraw` (simulated top-up), `GET /shop/transactions`, `GET /admin/wallet/overview`.

### settlement (`settlement` schema)
Tables: `settlements` (unique `bet_id, revision`), `settled_selections`, `match_settlements`, `operator_periods`, `operator_ledger_entries` (one per settlement, same transaction), `operator_ledger`, `commission_config`, `commission_ledger`.
`operator_result = gross_stakes − gross_payouts` over non-void settlements in the period; `operator_result_rate = operator_result / gross_stakes`. The shop share is `shop_share_percent` of the shop's own realised operator result in the period when that is positive, else 0; the platform share is the remainder.
Routes: `GET /settlements`, `/settlements/:betId`; admin: `GET /admin/settlements`, `POST /admin/settlements/:id/retry`, `GET /admin/operator`, `GET /admin/operator/periods`, `POST /admin/operator/periods/close`, `GET/PUT /admin/commission/config`, `GET /admin/commission`.

### identity (`identity` schema)
Tables: `customers`, `email_verifications`, `admin_users`, `shops`, `cashiers`, `sessions` (token hash only), `audit_logs`, `platform_settings`.
Routes: `/auth/*`, `/shop/auth/*`, `/shop/cashiers`, `/admin/auth/*`, `/admin/users*`, `/admin/shops*`, `/admin/audit`, `/admin/settings` — see `docs/frontend-api.md`.

### analytics (read-only)
Every figure is a SQL aggregate over `betting`, `settlement`, `risk`, `match`, `odds`, `identity`; formulas are in `docs/analytics.md`.
Internal: `GET /internal/analytics/overview|bets|matches/{id}|exposure|operator`. Gateway: `GET /admin/overview`, `/admin/reports/daily`, `/admin/analytics/overview`, `/admin/analytics/breakdown`, `/admin/analytics/sessions`, `/admin/analytics/matches/:id`, `/admin/analytics/accounts/:id`, `/admin/analytics/shops/:id`, `/admin/analytics/cashiers/:id`, `/shop/reports/daily`, `/shop/reports/daily/range`.

### event
`WS /live`. Channels `match:<matchId>`. Event types: the match-event types plus `BETTING_OPENED`, `BETTING_CLOSED`, `ODDS_UPDATED`, `SIMULATION_STARTED`, `SETTLEMENT_STARTED`, `SETTLEMENT_COMPLETED`. Sequences are per channel; clients re-read over REST on a gap.

### gateway
Route table = path, upstream, required actor kind, required permission. Login routes are rate limited in Redis. `GET /admin/health/services` is answered by the gateway from each upstream's `/ready`.

## 8. Shared read model

The columns below are read across schemas, so their names and types are part of the contract. An owner may add columns; it may not rename or retype these. Every timestamp is `timestamptz` (Prisma: `@db.Timestamptz(3)`). Status columns are read as text (`status::text`). Ids are `uuid`. Money is `bigint` kobo.

```
match.leagues        id, name, code, slug, country, sport, status, created_at
match.teams          id, league_id, name, short_name, code, city, stadium, color_primary, color_secondary,
                     strength, attack, defence, midfield, goalkeeping, pace, finishing, possession,
                     form, home_advantage, created_at, updated_at
match.fixtures       id, league_id, season, matchday, home_team_id, away_team_id, kickoff_at,
                     betting_closes_at, created_at
match.matches        id, fixture_id (unique), status, lifecycle, home_score, away_score,
                     revealed_sequence, completed_at, created_at, updated_at
match.match_transitions  id, match_id, from_state, to_state, at, actor, reason

odds.markets             id, match_id, type, line numeric(4,1) null, status, odds_version, created_at, updated_at
odds.market_selections   id, market_id, match_id, code, label, probability numeric(9,6), odds numeric(8,2), sort_order
odds.odds_snapshots      id, market_id, match_id, odds_version, reason, prices jsonb, created_at

simulation.simulation_runs  id, match_id, status, model_version, configuration_version, seed, attempt,
                            started_at, completed_at, failure_reason
simulation.match_results    match_id (pk), simulation_id, home_goals, away_goals, winner, winning_gap,
                            home_xg, away_xg, seed, model_version, configuration_version, stats jsonb, created_at
simulation.match_events     id, match_id, sequence, minute, type, side null, player null, secondary_player null,
                            score_home, score_away, description

betting.bets            id, user_id null, channel, shop_id null, cashier_id null, stake, currency,
                        total_odds numeric(12,2), potential_payout, status, payout null, risk_decision_id null,
                        idempotency_key, placed_at, settled_at null, cancelled_at null
betting.bet_selections  id, bet_id, match_id, market_id, selection_id, league_id, market_type, selection_code,
                        line null, odds numeric(8,2), odds_version, market_label, selection_label, match_label,
                        league_name, kickoff_at, outcome, result null
betting.tickets         id, bet_id (unique), code (unique), shop_id, shop_code, cashier_id, cashier_name,
                        customer_name null, customer_phone null, status, paid_at null, paid_by null,
                        expires_at, cancel_reason null, created_at

wallet.wallet_accounts      id, owner_type, owner_id, balance, reserved, currency, version, frozen_at null,
                            created_at, updated_at            -- unique (owner_type, owner_id)
wallet.wallet_transactions  id, account_id, type, amount (signed), currency, balance_after, idempotency_key,
                            reference null, note null, actor_id null, corrects_id null, created_at

settlement.settlements              id, bet_id, revision, outcome, stake, payout, channel, user_id null,
                                    shop_id null, cashier_id null, period_id, effects_applied_at null, settled_at
settlement.settled_selections       id, settlement_id, selection_id, match_id, outcome, result null
settlement.match_settlements        match_id (pk), status, bets_total, bets_settled, attempts, failure_reason null,
                                    started_at, completed_at null
settlement.operator_periods         id text (pk), kind, status, starts_at, ends_at null
settlement.operator_ledger_entries  id, settlement_id (unique), period_id, bet_id, channel, user_id null,
                                    shop_id null, cashier_id null, outcome, stake, payout, created_at
settlement.operator_ledger          period_id (pk), gross_stakes, gross_payouts, operator_result,
                                    operator_result_rate numeric(9,6), settled_bets, void_bets, refunded_stakes,
                                    status, created_at
settlement.commission_config        id, shop_id null, shop_share_percent numeric(5,2), effective_from, created_by, reason
settlement.commission_ledger        id, period_id, shop_id, gross_stakes, gross_payouts, gross_operator_result,
                                    shop_share_percent, shop_share_amount, platform_share_percent,
                                    platform_share_amount, created_at      -- unique (period_id, shop_id)

risk.risk_limits       version (pk), min_stake, max_stake_per_bet, max_payout_per_bet, max_liability_per_selection,
                       max_liability_per_market, max_liability_per_match, active, created_at, created_by, reason
risk.risk_decisions    id, request_id, actor_kind, actor_id, shop_id null, stake_requested, total_odds, decision,
                       reason, max_stake, legs jsonb, limits_version, created_at
risk.exposure_freezes  match_id (pk), frozen_at, snapshot jsonb

identity.customers    id, email, display_name, phone null, status, email_verified_at null, last_active_at, created_at
identity.admin_users  id, email, name, role, status, created_at
identity.shops        id, code, name, address, phone, email, status, owner_name, created_at
identity.cashiers     id, shop_id, username, display_name, role, status, last_active_at null, created_at
identity.audit_logs   id, actor_id, actor_role, actor_name, action, entity_type, entity_id, before jsonb, after jsonb,
                      reason, severity, request_id, created_at
```

Enumerations stored in these columns: `bets.status` `PENDING|WON|LOST|VOID|CANCELLED`; `bets.channel` `ONLINE|SHOP`; `bet_selections.outcome` `PENDING|WON|LOST|VOID`; `tickets.status` `OPEN|WON|LOST|VOID|CANCELLED|PAID|EXPIRED`; `markets.status` `OPEN|SUSPENDED|CLOSED|SETTLED|VOID`; `markets.type` and selection codes as in `marketTypeSchema` (`MATCH_RESULT`: `HOME|DRAW|AWAY`; `DOUBLE_CHANCE`: `HOME_DRAW|HOME_AWAY|DRAW_AWAY`; `OVER_UNDER` lines 1.5/2.5/3.5: `OVER_2_5|UNDER_2_5`…; `BOTH_TEAMS_TO_SCORE`: `YES|NO`; `GOAL_SPREAD` line −1.5: `HOME_MINUS_1_5|AWAY_PLUS_1_5`; `CORRECT_SCORE`: `CS_h_a` for 0–3 each, `CS_OTHER`); `match_events.type` as in `matchEventTypeSchema`; `simulation_runs.status` `RUNNING|COMPLETED|FAILED|CANCELLED`; `match_results.winner` `HOME|AWAY|DRAW`; `wallet_accounts.owner_type` `CUSTOMER|SHOP`; `settlements.outcome` `WON|LOST|VOID`.

## 9. Audit actions

`simulation_started`, `simulation_completed`, `simulation_failed`, `risk_configuration_changed`, `odds_configuration_changed`, `market_suspended`, `market_resumed`, `match_cancelled`, `settlement_started`, `settlement_completed`, `settlement_failed`, `manual_correction`, `commission_configuration_changed`, `simulation_configuration_changed`, `team_strength_changed`, `period_closed`, plus identity's own (`admin_login`, `customer_status_changed`, `shop_created`, …). System actors use `actorId = "system"`, `actorRole = "SYSTEM"`. A configuration change fails if its audit entry cannot be written; a lifecycle audit entry is best effort and logged on failure.
