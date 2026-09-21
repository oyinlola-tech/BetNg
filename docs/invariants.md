# BetNG invariants

BetNG is a simulation that uses play money. These are the rules the platform is built to keep, what enforces each one, and the test that proves it. `pnpm e2e` (`scripts/e2e/scenario.mjs`) runs the whole flow against the real services and asserts most of them together.

| # | Invariant | Enforced by | Proven by |
| --- | --- | --- | --- |
| 1 | One match has one authoritative result. | `simulation.match_results` has `match_id` as its primary key. A partial unique index on `simulation_runs(match_id)` for running/completed runs lets only one run exist; the run, the result and the events commit in one transaction, and a second `runMatch` returns the stored run with `duplicate: true`. | `services/simulation/tests/test_persistence.py` (sequential and concurrent runs), `apps/services/match/tests/scheduler.test.ts` (`runMatch` called once under overlapping ticks), e2e step 19. |
| 2 | All accounts consume the same match. | Fixtures, markets, odds, state, result and events are global rows keyed by one UUID. No route creates or varies a match per user, session, shop or request; the public read routes take no actor at all. | e2e step 6 (customers, both shops, TV and admin get identical match id, market ids, odds and odds version) and steps 12 and 18 (same timeline, same result). |
| 3 | Bets never determine match results. | `simulation.runMatch` accepts only the match id and the two teams; unknown fields are rejected (`extra="forbid"`). The engine is pure and takes no bet, bettor, shop or exposure input. The simulation login is never used to read the betting, wallet, risk or settlement schemas. | `services/simulation/tests/test_independence.py` (scenario A vs B, signature and field inspection, rejected bet-data payloads). |
| 4 | Risk controls exposure before betting closes. | Betting calls `risk.evaluate` before money moves and fails closed (`RISK_UNAVAILABLE`) when risk cannot answer. Risk answers ACCEPT, LIMIT or REJECT with a maximum stake; it has no client for the simulation and no SQL against its schema. Exposure is frozen at close. | `services/risk/tests/test_engine.py`, `test_global_exposure.py`, `test_no_result_path.py`; `apps/services/betting/tests/placement.test.ts`; e2e steps 7–9. |
| 5 | The simulation is independent of bettor identity. | Same as 3: there is no parameter through which a customer, shop or cashier could reach the engine. | `test_independence.py` (session independence). |
| 6 | Winning gap is derived from the result. | Computed as `abs(home − away)` after the score is sampled; a database CHECK on `match_results` rejects any other value, and another ties `winner` to the score. | `services/simulation/tests/test_engine.py`, e2e step 11. |
| 7 | Settlement uses the odds stored on the bet. | Betting stores the database's odds and `odds_version` on each leg (a client price that differs is refused as `ODDS_CHANGED`), and a trigger forbids changing them. Settlement reads only those columns and pays with integer arithmetic. | `apps/services/betting/tests/placement.test.ts` (snapshot), `apps/services/settlement/tests/payout.test.ts`, e2e steps 7 and 13. |
| 8 | PostgreSQL is authoritative. | One database, one schema and one login per service: a service can write only its own schema. Redis holds locks, the gateway's session cache and rate-limit counters, and runs without persistence. | `services/odds/tests/test_read_model.py` and `services/analytics/tests/test_security.py` (writes to foreign schemas refused). |
| 9 | The operator ledger is separate from customer wallets; the owner is not a customer. | Admins, cashiers and customers are three tables, and triggers forbid an email existing as both admin and customer. The wallet has only `CUSTOMER` and `SHOP` owner types (enum and CHECK) and refuses an admin id. The gateway and the betting service refuse a bet from an admin. The platform result exists only in `settlement.operator_ledger`. | `apps/services/wallet/tests/opening.test.ts`, `apps/services/identity/tests/rbac.test.ts`, `apps/services/settlement/tests/operator.test.ts`, e2e steps 7 and 15. |
| 9a | A negative operator result is recorded as it is. | `operator_result = gross_stakes − gross_payouts` is a CHECK and is allowed to be negative; ledger rows are append-only. Nothing rewrites a result, deletes a bet or moves money to compensate. | `operator.test.ts` (the −100,000 case), `services/analytics/tests/test_global_analysis.py`; the e2e run records whatever the match produced (e.g. −₦1,145). |
| 10 | Analytics aggregate every accepted bet. | Every figure is a SQL aggregate over all rows of `betting.bets`; the caller's identity never narrows the population. The analytics login is read-only and its transactions are read-only. Formulas: `docs/analytics.md`. | `test_global_analysis.py`, `test_breakdown_and_accounts.py`, e2e step 17. |
| 11 | Settlement is idempotent. | `INSERT … ON CONFLICT (bet_id, revision) DO NOTHING` decides whether a bet is settled; wallet credits and bet updates carry idempotency keys; a settled match answers `duplicate: true`. | `apps/services/settlement/tests/settlement.test.ts` (twice, concurrently, two instances), `apps/services/wallet/tests/ledger.test.ts`, e2e step 20. |
| 12 | Match results are immutable. | Triggers reject UPDATE, DELETE and TRUNCATE on `match_results` and `match_events`. The only remedy for a bad match is `VOID_MATCH`, which refunds stakes and is audited. | `test_persistence.py`, `apps/services/match/tests/routes.test.ts`. |
| 13 | Admin cannot pick a winner. | No route sets a score or an outcome. `START_SIMULATION` and `RERUN_SIMULATION` are refused with `RESULT_IMMUTABLE` once a result exists. Admins configure team strength, model parameters, margins, limits and commission, each as a new audited version. | `apps/gateway/tests/gateway.test.ts` (no such route), `routes.test.ts`, e2e step 19. |
| 14 | Frontends never generate authoritative state. | Stake limits, odds, payouts, roles and results are derived server-side from the session and the database. Clients display what the API returns. | `placement.test.ts` (client odds, stake and user id ignored), `gateway.test.ts` (forged actor headers dropped). |

## Result secrecy

A result exists from kick-off but is revealed over the match. Public and admin routes return only events whose reveal instant has passed and the score they imply; a simulation run's score and seed are `null` to everyone until the match is `COMPLETED`.

The seed is `HMAC-SHA256(SIMULATION_SEED_SECRET, "match_id:model_version:configuration_version")`. Every other input is public, so without the secret a result could be computed from the source code before betting closes. The stored seed still replays its run exactly. A run row, and so a seed, is written only at kick-off.

Tests: `services/simulation/tests/test_rest.py`, `test_seed_secret.py`, `apps/services/match/tests/routes.test.ts`, e2e step 10.

## Trust boundary

- The gateway is the only component that reads a session token. It builds upstream requests from scratch, so no client header reaches a service.
- Services honour the actor headers and `POST /rpc` only with `x-betng-internal-token`. Production refuses to start without `INTERNAL_SERVICE_TOKEN` or `SIMULATION_SEED_SECRET`, or with the `.env.example` placeholders.
- Every service re-checks the actor kind and permission and scopes data to the actor.
- Sessions are random tokens stored as SHA-256; passwords and PINs are scrypt hashes; admin 2FA is TOTP with replay refusal; repeated failures lock the account.
- The demo accounts and logged verification codes are opt-in (`SEED_DEMO_DATA`, `LOG_VERIFICATION_CODES`) and ignored in production.

Tests: `apps/gateway/tests/gateway.test.ts`, `apps/services/identity/tests/*`, e2e step 22.
