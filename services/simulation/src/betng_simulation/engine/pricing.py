"""Pricing: the score distribution the odds service turns into markets.

The progressive model is priced by Monte Carlo over the same core process a
result run plays. The pricing PRNG is seeded from a public, un-keyed
derivation under its own label, so it shares no draws with a result seed and
reveals nothing about one.
"""

from __future__ import annotations

import hashlib
import random
from collections import Counter
from dataclasses import dataclass

from .conditions import match_conditions
from .models import (
    FULL_TIME_MINUTE,
    HALF_TIME_MINUTE,
    LEGACY_MODEL_VERSION,
    PROGRESSIVE_MODEL_VERSION,
    ModelConfiguration,
    ProbabilityMatrix,
    TeamStrength,
    UnknownModelVersionError,
)
from .probabilities import calculate_probabilities, expected_goals, score_matrix
from .progressive import (
    LiveState,
    RateModel,
    game_state_factor,
    play_core,
    play_core_from,
    state_class,
)


def _strength_fingerprint(strength: TeamStrength) -> str:
    return ",".join(
        repr(float(value))
        for value in (
            strength.attack,
            strength.defence,
            strength.midfield,
            strength.goalkeeping,
            strength.pace,
            strength.finishing,
            strength.possession,
            strength.form,
            strength.home_advantage,
        )
    )


def pricing_seed(
    match_id: str | None,
    home: TeamStrength,
    away: TeamStrength,
    configuration: ModelConfiguration,
    state: LiveState | None = None,
) -> str:
    live = (
        "-"
        if state is None
        else (
            f"{state.minute}:{state.home_goals}:{state.away_goals}:"
            f"{state.home_reds}:{state.away_reds}"
        )
    )
    material = (
        f"pricing:{match_id or '-'}:{configuration.model_version}:"
        f"{configuration.version}:{_strength_fingerprint(home)}:"
        f"{_strength_fingerprint(away)}:{live}"
    )

    return hashlib.sha256(material.encode()).hexdigest()


@dataclass(frozen=True)
class ScoreSample:
    counts: Counter[tuple[int, int]]
    simulations: int
    home_goals: int
    away_goals: int


def sample_scores(
    home: TeamStrength,
    away: TeamStrength,
    configuration: ModelConfiguration,
    simulations: int,
    rng: random.Random,
    match_id: str | None = None,
) -> ScoreSample:
    """Play ``simulations`` independent cores and count their final scores."""
    model = RateModel.build(configuration, match_conditions(match_id, configuration))
    expected = expected_goals(home, away, configuration)
    counts: Counter[tuple[int, int]] = Counter()
    home_total = away_total = 0

    for _ in range(simulations):
        outcome = play_core(rng, home, away, model, expected=expected)
        counts[(outcome.home_goals, outcome.away_goals)] += 1
        home_total += outcome.home_goals
        away_total += outcome.away_goals

    return ScoreSample(counts, simulations, home_total, away_total)


def matrix_from_sample(
    sample: ScoreSample, configuration: ModelConfiguration
) -> ProbabilityMatrix:
    """Return the empirical score matrix; it grows past ``max_goals`` if needed."""
    largest = max(
        (max(home, away) for home, away in sample.counts),
        default=0,
    )
    size = max(configuration.max_goals, largest) + 1
    total = sample.simulations

    return ProbabilityMatrix(
        home_xg=sample.home_goals / total,
        away_xg=sample.away_goals / total,
        max_goals=size - 1,
        cells=tuple(
            tuple(sample.counts.get((home, away), 0) / total for away in range(size))
            for home in range(size)
        ),
    )


def monte_carlo_matrix(
    match_id: str | None,
    home: TeamStrength,
    away: TeamStrength,
    configuration: ModelConfiguration,
    simulations: int | None = None,
) -> ProbabilityMatrix:
    count = simulations or configuration.pricing_simulations
    rng = random.Random(int(pricing_seed(match_id, home, away, configuration), 16))

    return matrix_from_sample(
        sample_scores(home, away, configuration, count, rng, match_id),
        configuration,
    )


def price_match(
    match_id: str | None,
    home: TeamStrength,
    away: TeamStrength,
    configuration: ModelConfiguration,
) -> ProbabilityMatrix:
    """Return the matrix for the model version that will play the match."""
    if configuration.model_version == LEGACY_MODEL_VERSION:
        return calculate_probabilities(home, away, configuration)
    if configuration.model_version == PROGRESSIVE_MODEL_VERSION:
        return monte_carlo_matrix(match_id, home, away, configuration)

    raise UnknownModelVersionError(
        f"Unknown model version {configuration.model_version!r}."
    )


def remaining_share(minute: int, configuration: ModelConfiguration) -> float:
    """Return the share of a match's goal mass still to come after ``minute``."""
    if minute <= 0:
        return 1.0
    if minute >= FULL_TIME_MINUTE:
        return 0.0

    share = configuration.first_half_goal_share
    if minute <= HALF_TIME_MINUTE:
        played = share * (minute / HALF_TIME_MINUTE)
    else:
        played = share + (1.0 - share) * (
            (minute - HALF_TIME_MINUTE) / (FULL_TIME_MINUTE - HALF_TIME_MINUTE)
        )

    return max(0.0, 1.0 - played)


def sample_scores_from(
    home: TeamStrength,
    away: TeamStrength,
    configuration: ModelConfiguration,
    simulations: int,
    rng: random.Random,
    state: LiveState,
    match_id: str | None = None,
) -> ScoreSample:
    """Play ``simulations`` cores on from ``state`` and count their full-time scores."""
    model = RateModel.build(configuration, match_conditions(match_id, configuration))
    expected = expected_goals(home, away, configuration)
    counts: Counter[tuple[int, int]] = Counter()
    home_total = away_total = 0

    for _ in range(simulations):
        outcome = play_core_from(rng, home, away, model, state, expected=expected)
        counts[(outcome.home_goals, outcome.away_goals)] += 1
        home_total += outcome.home_goals
        away_total += outcome.away_goals

    return ScoreSample(counts, simulations, home_total, away_total)


def in_running_matrix(
    match_id: str | None,
    home: TeamStrength,
    away: TeamStrength,
    configuration: ModelConfiguration,
    state: LiveState,
    simulations: int | None = None,
) -> ProbabilityMatrix:
    count = simulations or configuration.pricing_simulations
    seed = pricing_seed(match_id, home, away, configuration, state)
    rng = random.Random(int(seed, 16))

    return matrix_from_sample(
        sample_scores_from(home, away, configuration, count, rng, state, match_id),
        configuration,
    )


def _legacy_in_running(
    home: TeamStrength,
    away: TeamStrength,
    configuration: ModelConfiguration,
    state: LiveState,
) -> ProbabilityMatrix:
    """Condition the closed-form model on the score, the clock and the dismissals."""
    home_xg, away_xg = expected_goals(home, away, configuration)
    remaining = remaining_share(state.minute, configuration)
    attack = (
        configuration.red_card_attack_penalty_min
        + configuration.red_card_attack_penalty_max
    ) / 2.0
    defence = (
        configuration.red_card_defence_penalty_min
        + configuration.red_card_defence_penalty_max
    ) / 2.0
    home_reds = max(0, min(state.home_reds, configuration.max_red_cards_per_team))
    away_reds = max(0, min(state.away_reds, configuration.max_red_cards_per_team))
    difference = state.home_goals - state.away_goals

    home_rest = (
        home_xg
        * remaining
        * (1.0 - attack) ** home_reds
        * (1.0 + defence) ** away_reds
        * game_state_factor(state_class(difference), state.minute, configuration)
    )
    away_rest = (
        away_xg
        * remaining
        * (1.0 - attack) ** away_reds
        * (1.0 + defence) ** home_reds
        * game_state_factor(state_class(-difference), state.minute, configuration)
    )

    rest = score_matrix(max(home_rest, 0.0), max(away_rest, 0.0), configuration)
    size = configuration.max_goals + max(state.home_goals, state.away_goals) + 1
    grid = [[0.0] * size for _ in range(size)]

    for scored, row in enumerate(rest):
        for conceded, cell in enumerate(row):
            grid[min(scored + state.home_goals, size - 1)][
                min(conceded + state.away_goals, size - 1)
            ] += cell

    return ProbabilityMatrix(
        home_xg=state.home_goals + home_rest,
        away_xg=state.away_goals + away_rest,
        max_goals=size - 1,
        cells=tuple(tuple(row) for row in grid),
    )


def price_match_in_running(
    match_id: str | None,
    home: TeamStrength,
    away: TeamStrength,
    configuration: ModelConfiguration,
    state: LiveState,
) -> ProbabilityMatrix:
    """Return the full-time matrix given what the match has settled so far."""
    if configuration.model_version == LEGACY_MODEL_VERSION:
        return _legacy_in_running(home, away, configuration, state)
    if configuration.model_version == PROGRESSIVE_MODEL_VERSION:
        return in_running_matrix(match_id, home, away, configuration, state)

    raise UnknownModelVersionError(
        f"Unknown model version {configuration.model_version!r}."
    )
