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
    LEGACY_MODEL_VERSION,
    PROGRESSIVE_MODEL_VERSION,
    ModelConfiguration,
    ProbabilityMatrix,
    TeamStrength,
    UnknownModelVersionError,
)
from .probabilities import calculate_probabilities, expected_goals
from .progressive import RateModel, play_core


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
) -> str:
    material = (
        f"pricing:{match_id or '-'}:{configuration.model_version}:"
        f"{configuration.version}:{_strength_fingerprint(home)}:"
        f"{_strength_fingerprint(away)}"
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
