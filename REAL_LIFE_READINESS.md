# BetNg — Real-Life Production Readiness

Re-verified against the working tree on 2026-09-23. Supersedes both the earlier
`REAL_LIFE_READINESS.md` (scanned 2026-09-22) and `PRODUCTION_READINESS_AUDIT.md`.

Most of the 2026-09-22 audit had gone stale within a day: the progressive
simulation model became the default, settlement and wallet began publishing
realtime signals, and RPC rate limiting, the risk audit trail, session
revocation on password change, HIBP breach checking and a 12-character password
minimum all landed. Its section 9 described a different project entirely. This
rewrite records what is actually true, what was fixed on 2026-09-23, and what
remains.

**Every claim below was checked against the code.** Where a previous audit
finding turned out to be wrong, that is stated rather than quietly dropped.

---

## 1. What this platform is

Seven TypeScript services under `apps/services/` — **betting, email, event,
identity, match, settlement, wallet** — plus the `apps/gateway` edge. Four
Python services under `services/` — **simulation, odds, risk, analytics** —
sharing `services/shared` (`betng_service_kit`).

Five frontends: `apps/web`, `apps/admin`, `apps/shop`, `apps/tv` (Vite + React
19) and `apps/mobile` (Expo 54 / React Native 0.81). Seven shared packages:
`brand`, `client-sdk`, `contracts`, `design-tokens`, `service-kit`, `ui-core`,
`ui-web`.

> The previous audit counted six TypeScript services and omitted the **email
> service** everywhere, including from its deployment checklists. It also
> described transactional email as SendGrid; there is no SendGrid in this
> codebase.

---

## 2. Fixed on 2026-09-23

### 2.1 In-running odds recalculation is now wired and actually moves prices (was HIGH)

The previous audit said `RecalculateOddsHandler` "exists and is fully
implemented" but nothing called it, and proposed wiring a trigger. The trigger
was missing, but wiring it alone would have achieved nothing, and two further
defects would have stopped it working at all:

1. **The handler asked for the pre-match matrix.** It called
   `probability_model.calculate(match_id, home, away, request_id)`, and
   `simulation.calculateProbabilities` accepted only `matchId`, `home`, `away`.
   The simulation caches on exactly that key, so recalculating after a goal was
   a **cache hit returning the identical pre-match distribution**. The
   "recalculation" would have bumped `oddsVersion` and republished the price the
   goal had just invalidated.
2. **The database rejected the write.** `odds.odds_snapshots.reason` carried
   `CHECK (reason IN ('INITIAL','ADMIN_REPRICE','STATUS_CHANGE'))`, while
   `_snapshot_reason` returns `GOAL`, `RED_CARD`, `HALF_TIME` or `SECOND_HALF`.
   Any recalculation would have failed on a constraint violation. The handler
   had never been executed end to end.
3. The RPC procedure took a raw `dict` and did unvalidated `payload["matchId"]`
   lookups, and carried a dead `RecalculateOddsRequest` class that nothing used.

**What now happens.** The simulation prices a match *in play* rather than
re-pricing it from kick-off:

- `engine/progressive.py` gained `LiveState` (minute, score, dismissals per
  side) and `play_core_from()`. `_Match.play(resume)` seeds the core with what
  the match has already settled and plays only the minutes that remain. The
  severity of each past red card is redrawn per simulation, because how much a
  dismissal cost a side is not known — only that it happened.
- `engine/pricing.py` gained `price_match_in_running()`. Under the progressive
  model it is Monte Carlo over the same core a result run plays, resumed from
  the live state, so pre-match and in-running prices stay on one model. Under
  the legacy model it is a closed-form conditional: expected goals scaled by the
  share of the match still to come, adjusted for dismissals and game state, then
  shifted by the current score.
- `CalculateProbabilitiesRequest` gained an optional `state`, and the handler's
  cache key includes it.
- The odds service passes the live state through `ProbabilityModel.calculate`,
  and the procedure takes a validated `RecalculateOddsRequest`.
- Migration `002_in_running_snapshots.sql` widens the snapshot-reason
  constraint, so a repricing names the event that moved the price.
- **The trigger**: `apps/services/match`'s reveal loop calls
  `odds.recalculateOdds` when it reveals a `GOAL`, `RED_CARD`, `HALF_TIME` or
  `SECOND_HALF`, once per batch against the state the batch ended on. Red cards
  are counted with a single aggregate over the revealed range
  (`SimulationReader.countDismissals`).

Odds is deliberately **not** on the reveal path: a match keeps playing whether
or not its markets could be moved, and a failed reprice leaves the last
published price standing rather than stalling the scheduler tick.

Measured behaviour (home side stronger; probabilities home/draw/away):

| State | Home | Draw | Away |
|---|---|---|---|
| Pre-match | 0.412 | 0.299 | 0.289 |
| Kick-off, 0-0 | 0.416 | 0.302 | 0.283 |
| 1-0 at 5' | 0.644 | 0.226 | 0.130 |
| 0-1 at 5' | 0.224 | 0.277 | 0.500 |
| 0-1 at 80' | 0.028 | 0.211 | 0.761 |
| 0-0 at 5', home red card | 0.232 | 0.304 | 0.464 |
| 1-1 at 90' | 0.000 | 1.000 | 0.000 |

Kick-off reproducing the pre-match price is the check that matters: the
in-running path is the same model conditioned on nothing, not a second model.
Under the legacy engine it reproduces it exactly.

Covered by `apps/services/match/tests/scheduler.test.ts` — repricing fires on
price-moving events, does **not** fire on a corner, batches half-time and the
second-half whistle into one move, and a refused reprice still banks the goal.

### 2.2 Encryption at rest for identity documents (was HIGH)

The previous audit pointed at `apps/services/wallet/src/configs/payments.config.ts`;
that is statement storage. KYC documents are stored by the **identity** service
(`src/services/kyc/storage.provider.ts`), and uploads are presigned PUTs made by
the client, so a bucket policy is the only thing that was standing between a
passport scan and unencrypted storage.

`StorageConfig` gained `encryption` (`AES256` or `aws:kms` plus a key id), and
`presignPut` now **signs** the `x-amz-server-side-encryption` headers and returns
them on the ticket. Because they are signed, storage refuses an upload that drops
them: encryption is enforced, not requested. Production refuses to start with KYC
storage configured and `KYC_STORAGE_SSE` unset.

New: `KYC_STORAGE_SSE`, `KYC_STORAGE_SSE_KMS_KEY_ID`.

### 2.3 Encryption key rotation (was MEDIUM)

`createFieldCipher` had a hard-coded `v1` ciphertext prefix and a single key, so
rotation meant a flag day and there was no way to read old rows under a new key.

It now takes a key ring. Every ciphertext names the key that wrote it; retired
keys are decrypt-only and never write. Rotation is a config change plus a
re-encryption pass. A ciphertext whose version the ring no longer holds is
**refused** rather than read wrong. Config refuses a retired list that collides
with the active version or repeats one.

New: `WALLET_ENCRYPTION_KEY_VERSION`, `WALLET_ENCRYPTION_KEYS_RETIRED`
(`version:base64key`, comma separated).

> `lookupHash` follows the **active** key, so a rotation must re-hash bank-account
> lookups alongside re-encrypting them or lookups stop matching. The re-encryption
> pass does both in one write; see §4.1.
>
> Found while writing that pass: the `*_ciphertext_only` CHECK constraints on
> `bank_accounts` and `bank_account_verifications` accepted only `v1:`, so the
> first bank-account write after a rotation would have failed. Migration
> `20260923120200_ciphertext_key_versions` accepts any key version and still
> refuses plaintext.

### 2.4 Webhook dead-letter queue (was MEDIUM)

`payment_webhook_events` held provider event ids for idempotency and, as its own
comment said, "No payload is stored". A webhook that verified but failed to apply
left nothing behind: no body to replay, no attempt count, no record that it
failed. Once the provider stopped re-delivering, the payment was lost silently.

Now: the verified body is retained **encrypted** (AES-256-GCM under the wallet
key) with the exact headers the provider read, alongside `attempts`, `last_error`,
`next_attempt_at`, `abandoned_at` and `signature_verified`. A failed apply records
the attempt and a backoff (30s, 2m, 10m, 1h, 6h) and leaves the event replayable.
The wallet job replays due events, **re-verifying the signature** from the stored
headers rather than trusting a row in our own database. On success or abandonment
the body is cleared, enforced by a table constraint — nothing sensitive is
retained longer than the recovery needs. Abandoned events are counted and logged
at error level, because nothing else will surface them.

Migration: `20260923090000_webhook_dead_letter`.

### 2.5 Simulation service could not start (not in the previous audit)

`controllers/simulation_controller.py` imported `BatchRunMatchBody`,
`BatchRunMatchRequest` and `BatchRunMatchResponse`, none of which
`dtos/__init__.py` re-exported. `import betng_simulation` raised `ImportError`,
so the service did not start and its entire test suite failed to collect. This
was committed on `main` (commit `0047445`, batch match simulation) and the
previous audit did not catch it. The three classes existed; only the export block
was missing.

Restoring the export exposed eight type errors that the broken import had been
hiding, all in the same batch work, and `scripts/python-check.sh` runs `mypy` in
CI (`.github/workflows/ci.yml`), so they were failing the build for everyone.
The annotations were wrong rather than the runtime: `_run_single_match` declared
`home: dict, away: dict` while being passed `SimulationTeamDto` and handing it
straight to `RunMatchRequest`, which wants exactly that.

One genuine latent bug sat underneath the typing. The error branch tested
`isinstance(result, Exception)`, but `asyncio.gather(return_exceptions=True)`
returns `BaseException`, and `CancelledError` is a `BaseException` and **not** an
`Exception`. A cancelled match run would have slipped past the error branch and
reached the response model as a raw exception object. Now tested as
`BaseException`.

`ruff` and `mypy` are clean across all 94 simulation files; 1791 tests pass.

Closed, verified 2026-09-27: a failed match in `results` used to be
`{"error": ...}` with no `match_id`, so a caller could only tell *which* match
failed by its position in the list. It is now a `BatchRunMatchFailure` carrying
`match_id` and `error`, covered by
`test_a_failed_batch_match_is_reported_by_its_match_id`.

### 2.6 Every club in the game fielded one country's players

The leagues are the Premier League, LaLiga, Serie A and Ligue 1, with real clubs
— Arsenal, Real Madrid, Juventus, Lorient. `engine/players.py` drew every squad
in the platform from a single Nigerian name pool, so Arsenal fielded eleven
players with Nigerian names. The previous audit noticed the pool only as a
collision-rate concern (§1.8) and missed that it was the wrong pool.

Squads are now drawn from the country of the club's league plus a weighted
foreign mix, because league football is cosmopolitan. 21 nationalities, 1228
names. The domestic share is set per league to roughly what the real leagues
field — England 40%, Spain 60%, Italy 55%, France 55% — and verified by
measurement rather than assumed. Goalkeepers carry a +20 point domestic bias:
clubs import outfielders far more readily than keepers, and a lone foreign keeper
in an otherwise domestic side reads as a mistake even when drawn fairly. Nigeria
stays in the foreign mix at a realistic weight alongside Senegal, Ivory Coast,
Morocco, Brazil, Argentina and the rest.

`country` is threaded from `match.fixture.league.country` through both
`simulation.runMatch` and `simulation.getSquads`. It is **optional everywhere**:
absent, the older single-pool behaviour stands, so no caller is forced to change.
Both paths must send it or the lineup endpoint would name different people than
the match timeline — there is a test pinning that.

Safe by construction: `squad_for` is seeded from `_squad_prng(team_id)`, a
different PRNG from the match seed, and the match RNG's draw sequence does not
depend on names. Changing the pools cannot move a scoreline or an event. Stored
`match_events` keep the names already written to them; only newly generated
squads differ, so a replay of an old run shows new names against an identical
scoreline. That was preferred to versioning the model for a cosmetic change.

---

## 3. Findings the previous audit got wrong

Recorded so nobody acts on them again.

| Previous finding | Reality |
|---|---|
| 1.1/1.2/1.3, 7.2.1–7.2.6, 7.2.9, 7.2.10 — simulation pre-samples events; progressive model is opt-in | The progressive model **is the default** (`engine/models.py`: `MODEL_VERSION = PROGRESSIVE_MODEL_VERSION`). It already implements red-card attack *and* defence penalties, leading/trailing factors with late-game urgency, momentum and "rattled" decay, fatigue and substitution freshness. `conditions.py` is a full weather model. `calibration.py` has Brier score and log-loss. Nearly all of section 7 was obsolete when written. |
| 1.8 — player pool too small | The pool had been expanded, but the audit missed the real defect: it was the *wrong* pool for these leagues. See §2.6. |
| 1.10 — no unified health endpoint | Wrong. The gateway serves `/admin/health/services`, aggregating every client. |
| 1.12 / 2.5 — no RPC rate limiting | Wrong. `RpcRateLimitMiddleware` is applied to every Python service in `betng_service_kit/app.py`. |
| 1.13 / 2.6 — admin risk changes not audited | Wrong. `update_limits_handler.py` writes the audit entry inside the same transaction. |
| 1.14 / 2.7 — sessions not revoked on password change | Wrong. `changePassword.handler.ts` calls `sessions.revokeOthers` then flushes the session cache evictor. |
| 2.2 — password minimum is 8 | It is 12 (`packages/contracts/src/auth/auth.type.ts`). |
| 2.11 — no breach password checking | Wrong. `identity/src/services/security/breachChecker.service.ts`, HIBP k-anonymity, wired into register, change-password and reset. |
| 3.5 — environment variables missing | Almost all existed under this repo's own names: `PAYMENTS_PROVIDER`, `PAYSTACK_*`, `FLUTTERWAVE_*`, `TERMII_*`, `FCM_*`, `KYC_STORAGE_*`, `SENDBYTE_*`, `VAPID_*`, `WALLET_ENCRYPTION_KEY`. |
| 5.3 — FCM "configured but not wired" | FCM HTTP v1 is fully implemented in `push.provider.ts`, with OAuth assertion signing, token caching and single-flight refresh. It is off because `PUSH_PROVIDER=none`, not because it is unwritten. |
| Section 9 (dependencies), entire | Described a different project. **There is no Next.js anywhere** in this repo, yet it listed `next 15.5.4` and advised upgrading Next 14→15. No `@trpc/server` either. It also contradicted itself: §9.1 listed React 19 / Prisma 6 / Tailwind 4 as current while §9.4 called for upgrading *to* them from React 18 / Prisma 5 / Tailwind 3. It claimed `.nvmrc` pins Node 22; there is no `.nvmrc`. It listed `@vitest/pretty-format` three times. |
| Structure | §1.12/1.13/1.14 were duplicated verbatim as §2.5/2.6/2.7, and §8.1–8.3 appeared twice. |

### Actual dependency state

| | Version |
|---|---|
| Node / pnpm | `engines`: node >= 24, pnpm >= 11 (`packageManager: pnpm@11.24.0`). No `.nvmrc`. |
| TypeScript | 7.0.2 |
| React / React DOM | 19.1.0–19.3.0 / 19.3.0 |
| Prisma / `@prisma/client` | 7.10.0 |
| Vite / Vitest | 8.3 / 5.0 |
| Tailwind | 4.3.3 |
| Zod | 4.3.6 |
| Expo / React Native | 54 / 0.81.4 |
| `@zudojs/*` | http 1.3.0, rpc 1.3.0, cqrs 1.1.1 |
| Python | `requires-python >= 3.12`; FastAPI 0.120+, Pydantic 2.10+, psycopg 3.2+ |

No upgrade is outstanding. What section 9 should have asked for is dependency
*monitoring* — see §4.6.

### 1.11 — settlement realtime signals: fixed, and the backstop stays

Settlement **does** publish `BET_SETTLED` (`settlement/src/clients/bet.signals.ts`)
and wallet publishes `WALLET_UPDATED`, so "settlement doesn't signal" is stale.
Publication was fire-and-forget. Since 2026-09-23 a failed publish is retried
after 250 ms, 1 s and 4 s, off the settlement path, and `idle()` drains retries on
shutdown. A signal can still be lost if the process dies mid-retry, so the
60-second re-read in `ui-core/src/adapters/platformDataSource.ts` stays as the
backstop.

---

## 4. What is still open

### 4.1 Re-encryption pass for key rotation — done 2026-09-23
`apps/services/wallet/src/security/rekey.ts` moves bank accounts, verifications and
dead-letter webhook bodies onto the active key, re-hashing `lookupHash` in the same
compare-and-set write. The wallet job runs it in batches while
`WALLET_ENCRYPTION_KEYS_RETIRED` is set, and logs `wallet_rekey_complete` once no row
is left on a retired key. Only then can the retired key be removed from config.
A row that no configured key opens is logged as `wallet_rekey_unreadable` and left
untouched.

Rotation, end to end: set the new key as `WALLET_ENCRYPTION_KEY` with a higher
`WALLET_ENCRYPTION_KEY_VERSION`, move the old one into
`WALLET_ENCRYPTION_KEYS_RETIRED`, deploy, wait for `wallet_rekey_complete`, then
remove the retired entry.

### 4.2 Risk engine has no caching (MEDIUM)
`evaluate_stake_handler.py` loads limits, selection states and the book on every
evaluation. The three reads are already parallel (`asyncio.gather`) and the code
states the intent — "exposure and market state are always read live" — so this is
a deliberate correctness-over-latency choice, not an oversight. Revisit under
measured load, not before.

### 4.3 Reconciliation — done 2026-09-23
The wallet job asks the provider again about every payment closed between 30
minutes and 72 hours ago. That catches what no webhook reported: a deposit paid
after it expired, a credit the provider has no record of, a refunded withdrawal the
bank paid anyway, or a wrong amount.
- **Agreement:** sets `reconciled_at`.
- **Disagreement:** flags the payment for an operator (`payment_reconciliation_mismatch`).
- **Bank-returned withdrawal:** the only case that moves money, through the existing reversal path.
- **Provider still processing:** backed off hourly through `reconcile_after`, and decided after 24 hours. An unpaid, abandoned checkout counts as agreement; a money-moving payment gets flagged.

It works per payment through the providers' existing verify calls. A
bulk import of a provider's settlement report would also catch a charge made
against a reference we never created. That needs the report APIs and is not
written.

### 4.4 No WebSocket in the Python services (INFO)
Realtime fan-out is the TypeScript event service. Python services reach clients
only by publishing through it. This is a design choice; recorded so it is not
rediscovered as a bug.

### 4.5 Service test databases never reset, and assertions rot into failure (MEDIUM)
`apps/services/match`, `apps/services/identity` and `apps/services/wallet` each
share one test database across their test *files*, and nothing resets it between
runs. Rows pile up indefinitely.

The consequence is not flakiness but **delayed, permanent failure**: an assertion
that searches the shared database globally, or asserts an absolute count, passes
while the table is small and then fails forever once enough history accumulates.
Two confirmed instances: `match/tests/discovery.test.ts` searched for `r%c`,
a literal substring of every previous run's rows, until the query limit truncated
the current run's row out of the result; and a webhook test written during this
session asserted an absolute `abandonedWebhooks()` count, which was 0 on the
first run and 4 on the fourth. Both were fixed by scoping to the run's own tag or
reference.

> Correction to an earlier draft of this document, which attributed the red
> suites to file parallelism. That was wrong. `vitest.config.ts` already sets
> `fileParallelism: false` on the `unit` project, so those files were already
> serialised. `--no-file-parallelism` appeared to fix things only because
> `npx vitest run --root apps/services/<name>` **bypasses the workspace config**
> and re-enables parallelism; the flag was undoing damage the `--root` flag had
> done. Run through the project (`npx vitest run --project unit`) and the setting
> is already correct.

The real guidance: on a red service suite, re-run the single file a few times. A
failure that repeats consistently is accumulated data, not interference — look
for a global query or an absolute count and scope it.

Current state, through the project config: the whole `unit` project is green,
1177 tests across 97 files, with match + identity + wallet contributing 419.
Python: odds 102, simulation 1791, both green, with `ruff` and `mypy` clean.

**Status 2026-09-27.** The `unit` project is still green, now 1204 tests across
100 files. The accumulation is measured rather than assumed:
`betng_test_match` holds 25,277 `match_transitions` and 14,079 simulation events,
`betng_test_identity` 5,021 audit logs and 3,400 customers, `betng_test_wallet`
4,950 ledger rows and 2,550 accounts. Betting and settlement share the pattern.

A reset is written but **has not been run and is not wired in**:
`scripts/db-test.sh` and `infrastructure/postgres/reset-test.sql`. `reset`
empties every table of each `betng_test_<service>` database and keeps the schema
and migration history; it refuses any database not named that way, refuses
`NODE_ENV=production`, and leaves a database alone while another session is
connected to it, so a second test run cannot empty one a first run is using.
`scripts/vitest-unit-setup.mjs` is the vitest global setup that would call it
before the first test file. Until it is added to the `unit` project in
`vitest.config.ts`, nothing changes.

Found alongside: CI never created these databases. The `service-tests` job
bootstrapped `betng` and `betng_test`, while the harnesses connect to
`betng_test_<service>`, so every service suite failed on GitHub with
`database "betng_test_betting" does not exist`. `scripts/db-test.sh` with no
argument creates and migrates all six and removes nothing; the job now runs it.
Run locally it reports no pending migrations. It has not yet run on GitHub
against an empty server.

### 4.6 Dependency monitoring — done 2026-09-23
`.github/dependabot.yml` covers npm, pip for every Python service, the Docker
constraints file, Actions and Docker/compose, weekly and grouped with a 7-day
cooldown. `.github/workflows/audit.yml` runs `pnpm audit --audit-level high` and
`pip-audit` per service each week. Neither has run on GitHub yet. Dependabot cannot
read Dockerfile base images set through `ARG` defaults, so those stay manual.

**Status 2026-09-27.** Dependabot has run and opened seven pull requests. Decided:

| Pull request | Decision |
|---|---|
| #1 nginx-unprivileged 1.29.8 → 1.31.5 | Taken. Digest checked against the registry; the edge configuration passes `nginx -t` under 1.31.5. `web.Dockerfile` moved to `1.31-alpine` with it. |
| #2 postgres 17 → 18 | Refused. A major version changes the data directory format; that is a planned dump and restore. Major bumps are now ignored. |
| #3 pydantic-core 2.46.5 → 2.49.0 | Refused. pydantic 2.13.5 requires `pydantic-core==2.46.5` exactly, so the constraint file would stop resolving. Ignored; it moves with pydantic. |
| #4 react 19.3.0, react-native 0.87.1 and four more in `apps/mobile` | Refused. Expo SDK 54 fixes react 19.1.0 and react-native 0.81; its own typecheck and lint fail on the pull request. |
| #5 async-storage 3, #6 expo-constants, #7 expo 57 | Refused for the same reason: an Expo SDK upgrade is one change made with `npx expo install --fix`. |

`apps/mobile` is excluded from npm version updates. Security alerts still cover it.

### 4.8 Code scanning, secret scanning and CI (2026-09-27)
Six CodeQL alerts were open. Five are fixed in code:

| Alert | Fix |
|---|---|
| #10 biased random, `applicationReference.ts` | `randomInt` per character. The old code was not actually biased, since 256 is a multiple of the 32-character alphabet, but it would have become so the moment the alphabet changed. |
| #9 polynomial regex, email `service.config.ts` | The address is checked by position, with a 254-character limit. Tested against a 100,000-character hostile value. |
| #6 polynomial regex, `sms.provider.ts` | `withoutTrailingSlashes` walks back from the end. The same pattern in identity's KYC endpoint uses it too. |
| #5 bad tag filter, `csp-hashes.mjs` | End tags with whitespace or attributes are matched, so an inline script closed by `</script >` is still hashed. |
| #8 URL substring, `providers.test.ts` | The test compares the parsed hostname. |

**#7, SHA-1 over a password in `breachChecker.service.ts`, cannot be fixed in
code.** The HIBP range API is defined over SHA-1; the digest is never stored and
only its first five characters leave the service. The inline `codeql[...]`
comment does not suppress an alert on GitHub. It has to be dismissed there as a
false positive.

The three secret-scanning alerts are placeholder signing secrets in test files
(`whsec_0123456789abcdef…`). They are in history, so changing the files closes
nothing; they have to be closed on GitHub as used in tests. `gitleaks` reported
eleven findings across history, every one a test placeholder or a published
example key; each was checked at its commit and recorded in `.gitleaksignore`,
and the history scan is clean.

CI on `main` was red in six jobs, each for its own reason:

| Job | Cause | State |
|---|---|---|
| `codeql` | The repository has CodeQL default setup enabled, and code scanning refuses a workflow upload while it is. | Job removed from `security.yml`; default setup covers Actions, JavaScript/TypeScript and Python. |
| `secrets` | The eleven gitleaks findings above. | Fixed. |
| `service-tests` | No `betng_test_<service>` database; `@betng/ui-core` not built for the mobile test. | Fixed in the workflow. |
| `unit` | `redisLock.test.ts` needs Redis and the job had none. | Redis service added. |
| `python` | `ruff format --check` failed on four files. | Formatted; `python-check.sh` passes. |
| `e2e` | No `.env`, so `prisma generate` had no database URL. | `.env.example` is copied first. Anything behind that failure is still unseen. |

The workflow changes are verified by reading the failure logs and by running the
same commands locally. None has run on GitHub yet.

### 4.7 Demo credentials in the seed (LOW, accepted)
`identity/src/seeds/demo.seed.ts` holds `betng-admin` / `betng-demo`. The seed
refuses to run in production and the file says so. The mobile `AuthScreen`
credentials the previous audit flagged are already gone. No action needed.

---

## 5. Still required before real money

Unchanged from the previous audit and still accurate; it is the one part that
needs no correction. Licensing and regulatory approval, segregated player funds
and a merchant account, live provider credentials (Paystack, Flutterwave, Bachs,
Termii, SendByte, FCM, S3/GCS, BVN/NIN), an approved KYC identity provider
(`KYC_IDENTITY_PROVIDER` is `sandbox` or `unconfigured` today — there is no real
one), independent RNG certification for the simulation, penetration testing, and
24/7 support.

The technical critical path is now shorter than it was. In-running pricing was
the item that could not be deferred, because static odds during live play are
exploitable by anyone who watches a match faster than the market. That is done.
What remains before a real-money launch is mostly procurement, compliance and
operations rather than code — with the exception of §4.5, which is ours.
