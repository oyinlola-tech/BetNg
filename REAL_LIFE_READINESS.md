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

> Caveat, deliberately not hidden: `lookupHash` follows the **active** key, so a
> rotation must re-hash bank-account lookups alongside re-encrypting them or
> lookups stop matching. The re-encryption pass itself is not written yet — see
> §4.1.

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

Still open as a product question, not a bug: a failed match in `results` is
`{"error": ...}` with no `match_id`, so a caller can only tell *which* match
failed by its position in the list.

---

## 3. Findings the previous audit got wrong

Recorded so nobody acts on them again.

| Previous finding | Reality |
|---|---|
| 1.1/1.2/1.3, 7.2.1–7.2.6, 7.2.9, 7.2.10 — simulation pre-samples events; progressive model is opt-in | The progressive model **is the default** (`engine/models.py`: `MODEL_VERSION = PROGRESSIVE_MODEL_VERSION`). It already implements red-card attack *and* defence penalties, leading/trailing factors with late-game urgency, momentum and "rattled" decay, fatigue and substitution freshness. `conditions.py` is a full weather model. `calibration.py` has Brier score and log-loss. Nearly all of section 7 was obsolete when written. |
| 1.8 — player pool too small | Already expanded (`EXPANDED_GIVEN_NAMES` / `EXPANDED_SURNAMES`). |
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

### 1.11 — settlement realtime signals: partly fixed, and the backstop is still load-bearing

Settlement **does** publish `BET_SETTLED` (`settlement/src/clients/bet.signals.ts`)
and wallet publishes `WALLET_UPDATED`, so "settlement doesn't signal" is stale.
But publication is fire-and-forget: a failure is logged and never retried, so a
signal can genuinely be dropped. The 60-second re-read in
`ui-core/src/adapters/platformDataSource.ts` is therefore still the only recovery
path, and removing it would leave an account view that silently stops moving.
Making publication reliable belongs on settlement's side, not in the client.

---

## 4. What is still open

### 4.1 Re-encryption pass for key rotation (MEDIUM)
The key ring (§2.3) makes rotation *possible*; nothing yet walks existing rows,
decrypts under the retired key and rewrites under the active one, re-hashing
`lookupHash` in the same pass. Until it exists a rotation leaves old rows on the
old key indefinitely, and the retired key can never be dropped.

### 4.2 Risk engine has no caching (MEDIUM)
`evaluate_stake_handler.py` loads limits, selection states and the book on every
evaluation. The three reads are already parallel (`asyncio.gather`) and the code
states the intent — "exposure and market state are always read live" — so this is
a deliberate correctness-over-latency choice, not an oversight. Revisit under
measured load, not before.

### 4.3 Reconciliation tooling (MEDIUM)
The dead-letter queue (§2.4) makes a lost webhook visible and replayable. There is
still no tool that reconciles our payment rows against a provider's settlement
report, which is what catches an event the provider never sent at all.

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

### 4.6 Dependency monitoring (LOW)
Nothing is out of date, but nothing watches: no Dependabot or Renovate, no
scheduled `pnpm audit` / `pip-audit`, no advisory subscription.

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
operations rather than code — with the exception of §4.1 and §4.5, which are ours.
