# BetNG simulation: the match model and how it is priced

The simulation service (`services/simulation`) plays every virtual match once and produces the score distribution the odds service prices from. This document describes the model, its parameters and versions, the pricing method, the replay audit, and the calibration and timing measured on this build. The service contract is in `docs/architecture.md`. This document does not change it; it only adds the optional fields listed under [Contract additions](#contract-additions).

## Guarantees

- **One authoritative result per match.** `simulation.runMatch` commits the run, the result and the events in one transaction behind a unique index. A repeat call returns the stored run with `duplicate: true` and never plays the match again.
- **No bet data.** The engine's inputs are the match id, the two teams (id, names, `TeamStrength`), the model configuration and the seed key. Request models reject unknown fields at every depth, so a stake, bettor, shop or exposure field is a validation error. Pricing takes the match id and the two strengths only.
- **Results are immutable.** Database triggers reject `UPDATE`, `DELETE` and `TRUNCATE` on `match_results` and `match_events`. The winner and the winning gap are derived from the score, and a `CHECK` constraint rejects any row that disagrees with its own score.
- **Deterministic and replayable.** One PRNG, seeded from `HMAC-SHA256(SIMULATION_SEED_SECRET, "{match_id}:{model_version}:{configuration_version}")` (plain SHA-256 when the key is unset outside production), drives every draw of a result run. The derivation and the secret handling are the same as before. The same inputs always reproduce the same result, timeline and stats.
- **No in-play betting.** Betting closes before kick-off, so the product never offers in-running odds. The model plays minute by minute because that makes the result more realistic, not because prices change during a match. Only one price exists: the pre-match one.

## Model versions

| `modelVersion` | Status | What decides the score |
| --- | --- | --- |
| `poisson-1.0` | Legacy; still selectable | Samples a score from an independent-Poisson matrix with a Dixon–Coles correction, then decorates a timeline around it |
| `progressive-2.0` | Default | The score is whatever the minute-by-minute timeline produces (below). No score is drawn in advance |

Every stored configuration version names its model version, and both are recorded on every run. A run always replays under its own version, so a `poisson-1.0` run from before the upgrade still reproduces bit for bit (see [Replay audit](#replay-audit)). Each model also has its own squad name pool, so a replayed legacy timeline names the same players as before.

On start-up, if no stored version uses `progressive-2.0`, the service stores one new configuration version on it. It copies every tuned parameter from the active version, gives the new parameters their defaults, activates it, logs `simulation_configuration_changed` and submits a system audit entry. This happens once. An admin can switch models with `PUT /admin/simulation/config` `{ "modelVersion": "poisson-1.0" | "progressive-2.0", "reason": … }`. Omitting `modelVersion` keeps the active version's model. Any other value is `422`.

## The progressive model (`progressive-2.0`)

### Base intensities

Pre-match expected goals `xG_home`, `xG_away` come from the same rating formula as before (`expected_goals`: weighted attack/finishing/midfield/pace/possession against defence/goalkeeping/midfield, form, home advantage, clamped to `[minExpectedGoals, maxExpectedGoals]`). The per-minute base scoring probability is `xG / effectiveMinutes`. `effectiveMinutes` (default 104) is calibrated so that the simulated mean goals equal the pre-match xG. Measured ratios of simulated to pre-match goals are 0.99–1.01 across strong-v-weak, even and weak-v-strong pairings.

### Minute by minute

The match is played in steps of one minute: 1–45, then first-half stoppage, then 46–90, then second-half stoppage. In each minute:

```
P(goal by side s) = base_s × period(m) × state(s, m) × redCard_s × concession_opponent
                    × momentum × vulnerability × fatigue × weather·pitch
```

- `period(m)` = `2 × firstHalfGoalShare` in the first half and `2 × (1 − firstHalfGoalShare)` in the second, so goals rise after the break and the match mean is unchanged.
- **Game state** `state(s, m)`, with pressure `p = min(m, 90) / 90`:
  - A leading side sits back: `1 + (leadingAttackFactor − 1)·p`. It also counter-attacks into the space a chasing side leaves: `× (1 + (counterAttackFactor − 1)·p)`.
  - A trailing side pushes: `1 + (trailingAttackFactor − 1)·p`. When it is exactly one goal down from `lateUrgencyMinute`, it pushes harder: `× lateUrgencyFactor`.
  - A level score is `1`.
  - Stoppage minutes use the pressure of minute 45 or 90.
- **Red cards.** Each sending-off draws an offence penalty from `[redCardAttackPenaltyMin, redCardAttackPenaltyMax]`, which multiplies the reduced side's rate by `1 − penalty`. It also draws a defence penalty from `[redCardDefencePenaltyMin, redCardDefencePenaltyMax]`, which multiplies the opponent's rate by `1 + penalty`. Both are drawn from the match PRNG and compound for each further red card, up to `maxRedCardsPerTeam`.
- **Momentum.** After a goal, the scorer's rate is boosted by `momentumBoost` and the conceding side is vulnerable by `concedeVulnerability`. Both decay linearly to nothing over `momentumMinutes`. The next goal by either side resets them.
- **Cards.** Yellow and straight-red rates are `yellowCardsPerTeam / effectiveMinutes` and `redCardProbability / effectiveMinutes`. They are multiplied by the referee and weather card factor, and by `trailingCardFactor` while the side is behind. A yellow goes to an outfield player on the pitch, with booked players weighted by `bookedPlayerCaution`. A second yellow is a `YELLOW_CARD` followed by a `RED_CARD` ("sent off after a second yellow"), with the same penalties as a straight red.
- **Substitutions.** Each side makes between `minSubstitutions` and `maxSubstitutions` changes at minutes drawn in 46–88. A substitute is fresh and unbooked.
- **Stoppage time** is derived from what happened in the half: `round(base + stoppagePerGoal·goals + stoppagePerCard·cards + stoppagePerSubstitution·subs)`, capped at `maxStoppageFirstHalf` / `maxStoppageSecondHalf`. The measured means are 2.2 and 5.7 minutes.
- One uniform draw per minute decides whether any core event (goal, yellow or red, for either side) happens. A second draw, scaled by the rates, picks which one. There is at most one core event per minute.

The **core** (goals, cards, sending-offs, substitutions, stoppage) is the only thing that decides the score. The **narration** reads the core's state and draws from the same PRNG. It picks the scorer (weighted by position), the assist and the booked or substituted player, and it produces corners, shots, fouls, offsides and possession. It never changes a rate, and a test enforces this. Pricing therefore runs the core alone, and the score distribution is the same as that of a full result run.

- **Corners** are timed events. Each side's per-minute rate is scaled by its current pressure (current scoring rate ÷ neutral rate, clamped to 0.5–2.5).
- **Shots**: every goal is a shot on target. Further shots on and off target are Poisson draws whose means integrate the minute-by-minute scoring rates (`extraShotsOnTargetPerTeam × xG/baseGoals`, as before).
- **Fouls** integrate a trailing-side factor and the referee and pitch; every card is also a foul. **Offsides** integrate pressure.
- **Possession** averages a per-minute share from ratings. It shifts towards a trailing side (`possessionStateShift` per goal of deficit, scaled by pressure) and away from a side with fewer players (`possessionRedCardShift` per red card), plus one noise draw.
- **xG** stored on the result (`home_xg`, `away_xg`) is the sum of the per-minute scoring probabilities actually experienced in the match.

### Events and the existing contract

The event types, the stats shape and the `runMatch` response shape are unchanged. Event minutes stay within the contract's clock: an event in first-half stoppage is stored at minute 45, and one in second-half stoppage at 90, before `HALF_TIME` or `FULL_TIME` in sequence order. Its description starts with the real clock (`"90+3' Goal for …"`). The `HALF_TIME` and `FULL_TIME` descriptions state the added minutes.

### Optional factors (default off)

All factors are deterministic and use no external data. They are derived from the match id, which is public before kick-off, so price and result always see the same conditions.

| Parameter | Default | Bounds | Effect |
| --- | --- | --- | --- |
| `weatherEnabled` | `false` | bool | When on, each match's weather is drawn from `sha256("weather:{matchId}")`: clear 55%, rain 20%, heavy rain 8%, wind 10%, heat 7%. It is announced on the `KICK_OFF` event |
| `weatherSeverity` | 0.5 | 0–1 | Scales each condition's effect from neutral to full. At full severity, heavy rain gives goals ×0.85, cards ×1.1, corners ×1.1 and fatigue ×1.25. Rain gives goals ×0.94, wind goals ×0.92 and corners ×1.1, heat goals ×0.95 and fatigue ×1.4 |
| `pitchQuality` | 1.0 | 0.5–1 | Goals ×(0.8 + 0.2q); fouls ×(1 + 0.5(1 − q)) |
| `refereeStrictness` | 1.0 | 0.5–1.5 | Card rates × strictness; fouls ×(0.5 + 0.5·strictness) |
| `refereeVariance` | 0 | 0–0.5 | Per-match strictness × (1 ± variance), drawn from `sha256("referee:{matchId}")` |
| `fatigueEnabled` | `false` | bool | When on, from `fatigueOnsetMinute` a side tires by `fatigueRate` per minute. The rate is scaled by `1.5 − pace/100`, by the weather's fatigue factor and by `1 − substitutes/10`. Its own rate is multiplied by `1 − fatigue` and the opponent's by `1 + fatigue` (capped at 0.5) |
| `fatigueOnsetMinute` | 60 | 30–90 | |
| `fatigueRate` | 0.005 | 0–0.02 | |

### Parameters added by `progressive-2.0`

These are all tunable through `PUT /admin/simulation/config`, validated by bounds, and stored in each configuration version. The existing parameters keep their meaning. `rho` and `maxGoals` affect only the legacy matrix and the minimum size of the priced matrix.

| Parameter | Default | Bounds |
| --- | --- | --- |
| `effectiveMinutes` | 104 | 80–130 |
| `stoppageFirstHalfBase` / `stoppageSecondHalfBase` | 1 / 2 | 0–5 / 0–8 |
| `stoppagePerGoal` / `stoppagePerCard` / `stoppagePerSubstitution` | 0.5 / 0.3 / 0.3 | 0–2 each |
| `maxStoppageFirstHalf` / `maxStoppageSecondHalf` | 5 / 8 | 0–10 / 0–15 |
| `leadingAttackFactor` | 0.85 | 0.5–1.5 |
| `trailingAttackFactor` | 1.2 | 0.5–2 |
| `counterAttackFactor` | 1.15 | 0.5–2 |
| `lateUrgencyMinute` / `lateUrgencyFactor` | 75 / 1.2 | 46–90 / 0.5–2 |
| `redCardAttackPenaltyMin` / `Max` | 0.15 / 0.35 | 0–0.8, min ≤ max |
| `redCardDefencePenaltyMin` / `Max` | 0.2 / 0.5 | 0–1.5, min ≤ max |
| `maxRedCardsPerTeam` | 3 | 0–3 |
| `bookedPlayerCaution` | 0.35 | 0–1 |
| `trailingCardFactor` | 1.2 | 0.5–2 |
| `momentumBoost` / `concedeVulnerability` / `momentumMinutes` | 0.2 / 0.1 / 5 | 0–1 / 0–1 / 0–15 |
| `possessionStateShift` / `possessionRedCardShift` | 3 / 5 | 0–10 / 0–15 |
| `pricingSimulations` | 5000 | 1000–50000 |

With the defaults, a match has about 3.55 yellow cards, 0.18 red cards and 29 timeline events.

Stored versions are immutable. The loader reads the pre-release key `trailingExposureFactor` as `counterAttackFactor`, so versions written under that name still load and replay.

## Pricing

`simulation.calculateProbabilities` reads the active configuration and prices the match with the model version that will play it:

- **`progressive-2.0`**: a Monte Carlo of `pricingSimulations` independent runs of the same core process (same `RateModel`, same conditions, same code path) that a result run plays. The pricing PRNG is seeded from `sha256("pricing:{matchId}:{modelVersion}:{configurationVersion}:{home strengths}:{away strengths}")`. That label is distinct from the result seed's material and the derivation is un-keyed, so the pricing stream shares no draws with a result and reveals nothing about the result seed or the key. A test checks that a result coincides with the first priced simulation no more often than chance. The response's `scoreMatrix[h][a]` is the empirical frequency of each score, sized `max(maxGoals, largest simulated score) + 1`, and sums to 1. `homeXg` and `awayXg` are the simulated mean goals.
- **`poisson-1.0`**: the analytic matrix, as before.

The odds service sends `matchId` with every pricing call. It derives every market (1X2, double chance, totals 1.5/2.5/3.5, both teams to score, spread −1.5, correct score 0–3 plus other) from the matrix and applies its margins, bounds and 2-dp rounding exactly as before. A correct score never seen in the simulations prices at the configured maximum odds.

**Caching.** Results are cached in-process per `(matchId, modelVersion, configurationVersion, strengths)` (LRU, 512 entries). The Monte Carlo runs in a worker thread so the event loop keeps serving. The odds service stores the published prices, and `odds.publishMarkets` is idempotent, so a match is normally priced once.

**Precision.** With N = 5000, the Monte Carlo standard error is at most 0.0071 on any probability (p = 0.5), for example ±0.03 on fair odds of 2.00, and 0.0042 on a 10% correct score.

## Replay audit

`POST /internal/simulation/matches/{matchId}/replay` (internal token) and RPC `simulation.replayMatch` `{ matchId }` do the following:

1. Load the completed run, its recorded inputs (migration `003_run_inputs.sql` adds `simulation_runs.inputs`: both teams with their strengths), and the stored configuration version the run used.
2. Replay it from the stored seed under its own model version.
3. Compare the result, every event, the stats and the xG with the stored rows.

The response is:

```
{ matchId, simulationId, modelVersion, configurationVersion, replayable, identical,
  seedVerified, mismatches: ("result"|"events"|"stats"|"xg"|"seed")[], eventCount, reason }
```

`seedVerified` re-derives the seed with the service's key and compares it in constant time. It is `null` when the service has no key. The response never contains the seed. Replay stores nothing. Runs from before migration 003 have no recorded inputs and answer `replayable: false`.

A batch `runMatch` was not added: the match service plays each match at its own kick-off, one call per match, well within the RPC budget. Batch simulation exists at engine level, where Monte Carlo pricing and calibration run many simulations in one call (`sample_scores`).

## Squads

Squads remain a pure function of the team id. `progressive-2.0` draws from an expanded pool of 135 given names × 167 surnames (22,545 names), about 13 times the legacy pool of 1,760. Measured across 120 teams, two squads share on average 0.013 names, against 0.184 under the legacy pool. `simulation.getSquads` answers with the active model's pool. It also accepts an optional `modelVersion`, so a finished match's lineup can be read in the pool its timeline used.

## Calibration

`tests/test_calibration.py` checks the published probabilities against independent full result runs. For each of three pairings (strong v weak, even, weak v strong), and once with fatigue, a strict referee and a poor pitch switched on, it does the following:

- Prices the match (Monte Carlo, N = 6000).
- Plays 3000 full result runs of different matches with the same teams.
- Asserts that every checked market is within 4σ of the two-sample binomial error. The checked markets are 1X2, over 1.5/2.5/3.5, both teams to score, home −1.5 and the five likeliest correct scores.
- Asserts that the Brier score is within 0.03 of the forecast's expected Brier score and below the uniform forecast, and that the log-loss is below ln 3.

`tests/test_progressive.py` checks the following:

- Trailing sides score faster, leaders sit back, and urgency applies late.
- A red card lowers the reduced side's rate within the configured range and raises the opponent's. Empirically, the goal difference moves against the reduced side.
- Momentum decays to nothing.
- Weather, pitch, referee and fatigue move the rates in the stated directions.
- The fast path's rates equal the rate model's in every minute.
- Stoppage events stay inside their half.
- A second yellow is followed by the red.
- Simulated mean goals match the pre-match xG within 8–12%.

Determinism and invariant tests cover the following:

- The same seed gives an identical timeline and result.
- The engine's and the request models' signatures carry no bet data.
- A duplicate `runMatch` returns the stored run.
- Result rows reject updates.
- The winner and gap are derived.
- A replay of a stored run (legacy and progressive) is identical.

Measured on this build, with the default configuration: Monte Carlo at the production N = 5000, against 10,000 independent result runs per pairing. z is the difference over its two-sample standard error.

| Market | Strong v weak priced / observed (z) | Even priced / observed (z) | Weak v strong priced / observed (z) |
| --- | --- | --- | --- |
| Home | 0.6974 / 0.7013 (−0.49) | 0.3908 / 0.3856 (+0.62) | 0.1410 / 0.1403 (+0.12) |
| Draw | 0.2078 / 0.1985 (+1.32) | 0.3010 / 0.3067 (−0.72) | 0.2506 / 0.2479 (+0.36) |
| Away | 0.0948 / 0.1002 (−1.06) | 0.3082 / 0.3077 (+0.06) | 0.6084 / 0.6118 (−0.40) |
| Over 1.5 | 0.8448 / 0.8442 (+0.10) | 0.7790 / 0.7884 (−1.31) | 0.8120 / 0.8146 (−0.38) |
| Over 2.5 | 0.6264 / 0.6322 (−0.69) | 0.5442 / 0.5353 (+1.03) | 0.5744 / 0.5795 (−0.60) |
| Over 3.5 | 0.4188 / 0.4193 (−0.06) | 0.3432 / 0.3293 (+1.69) | 0.3684 / 0.3691 (−0.08) |
| Both teams to score | 0.5522 / 0.5512 (+0.12) | 0.5996 / 0.6068 (−0.85) | 0.5606 / 0.5677 (−0.83) |
| Home −1.5 | 0.4710 / 0.4724 (−0.16) | 0.1876 / 0.1837 (+0.58) | 0.0430 / 0.0460 (−0.85) |
| Top correct score | 1–1: 0.1038 / 0.0903 (+2.56) | 1–1: 0.1346 / 0.1505 (−2.69) | 1–1: 0.1168 / 0.1199 (−0.56) |
| 2nd correct score | 2–0: 0.1034 / 0.1109 (−1.42) | 1–0: 0.0818 / 0.0789 (+0.61) | 0–2: 0.1024 / 0.0976 (+0.91) |
| 3rd correct score | 2–1: 0.0962 / 0.0989 (−0.53) | 2–1: 0.0808 / 0.0829 (−0.44) | 1–2: 0.0934 / 0.0972 (−0.75) |
| Brier (1X2) / expected | 0.4589 / 0.4615 | 0.6626 / 0.6617 | 0.5446 / 0.5472 |
| Brier, uniform forecast | 0.6667 | 0.6667 | 0.6667 |
| Log-loss (1X2) vs ln 3 | 0.8007 vs 1.0986 | 1.0927 vs 1.0986 | 0.9219 vs 1.0986 |

The largest |z| over the 33 comparisons is 2.69, and the two largest deviations have opposite signs, which is consistent with sampling noise. The pre-match xG for the three pairings is 2.45–0.86, 1.52–1.35 and 0.97–2.11. The Monte Carlo means are 2.41–0.88, 1.54–1.36 and 0.97–2.08.

## Performance

Measured on the development machine, which was shared with other workloads. Its reference loop (`for i in range(1_000_000): x += i*0.5`) took 39–143 ms across runs, so absolute numbers vary about 3×.

| Operation | Measured |
| --- | --- |
| One core simulation (pricing inner loop) | 140–260 µs |
| One full result run in-process (`simulate`) | mean 2.4 ms, p50 1.8 ms, p95 5.8 ms, p99 10 ms (legacy: 1.4 ms mean) |
| `simulation.runMatch` over RPC, including the database commit | p50 17 ms, p95 37 ms, max 44 ms (RPC timeout 10 s) |
| `simulation.calculateProbabilities`, cold (N = 5000) | 0.78–1.03 s (odds → simulation timeout `SERVICE_TIMEOUT_MS`, 5 s) |
| `simulation.calculateProbabilities`, cached | 3–9 ms |
| Monte Carlo alone at N = 2000 / 5000 / 10000 | 0.52 s / 0.71 s / 1.55 s |
| Replay of a stored run over HTTP | 45 ms |

N = 5000 is the default because it keeps a cold price at about a fifth of the pricing call's timeout on this machine, with the precision stated above.

## Contract additions

All additions are optional and backwards compatible.

- `simulation.calculateProbabilities` accepts an optional `matchId` (UUID). The odds service always sends it. Without it, pricing is seeded from the strengths and configuration alone, and weather and referee variance are neutral.
- `simulation.getSquads` accepts an optional `modelVersion` (`poisson-1.0` | `progressive-2.0`).
- New: RPC `simulation.replayMatch` and `POST /internal/simulation/matches/{id}/replay` (described above).
- `PUT /admin/simulation/config` accepts an optional `modelVersion` and the parameters listed above. The configuration view returns all parameters.
- `simulation_runs.inputs` (jsonb, nullable) records the teams each run was played with.
- Admin run actions (`RETRY`, `CANCEL`) write their audit entry inside the action's transaction. If the entry cannot be recorded, the action rolls back and answers `503 UPSTREAM_UNAVAILABLE`.
