"""Expected goals and the score matrix.

The matrix built here is the single source of probability on the platform: the
odds service prices from it and :mod:`.goals` samples the result from it, so a
price and the outcome it prices always come from the same distribution.
"""

from __future__ import annotations

import math

from .models import ModelConfiguration, ProbabilityMatrix, TeamStrength


def _weighted_mean(pairs: tuple[tuple[float, float], ...]) -> float:
    total_weight = sum(weight for _, weight in pairs)

    if total_weight <= 0:
        raise ValueError("The configuration's weights must not all be zero.")

    return sum(value * weight for value, weight in pairs) / total_weight


def offensive_rating(team: TeamStrength, configuration: ModelConfiguration) -> float:
    return _weighted_mean(
        (
            (team.attack, configuration.attack_weight),
            (team.finishing, configuration.finishing_weight),
            (team.midfield, configuration.midfield_attack_weight),
            (team.pace, configuration.pace_weight),
            (team.possession, configuration.possession_attack_weight),
        )
    )


def defensive_rating(team: TeamStrength, configuration: ModelConfiguration) -> float:
    return _weighted_mean(
        (
            (team.defence, configuration.defence_weight),
            (team.goalkeeping, configuration.goalkeeping_weight),
            (team.midfield, configuration.midfield_defence_weight),
        )
    )


def _side_expected_goals(
    attacking: TeamStrength,
    defending: TeamStrength,
    venue_factor: float,
    configuration: ModelConfiguration,
) -> float:
    gap = (
        offensive_rating(attacking, configuration)
        - defensive_rating(defending, configuration)
    ) / configuration.rating_scale

    expected = (
        configuration.base_goals
        * math.exp(configuration.strength_sensitivity * gap)
        * math.exp(configuration.form_weight * attacking.form)
        * venue_factor
    )

    return min(
        max(expected, configuration.min_expected_goals),
        configuration.max_expected_goals,
    )


def expected_goals(
    home: TeamStrength, away: TeamStrength, configuration: ModelConfiguration
) -> tuple[float, float]:
    """Each side's expected goals, from its attack against the other's defence."""
    home_venue = 1.0 + (
        configuration.home_advantage_weight
        * home.home_advantage
        / configuration.rating_scale
    )

    return (
        _side_expected_goals(home, away, home_venue, configuration),
        _side_expected_goals(away, home, 1.0, configuration),
    )


def _poisson_pmf(mean: float, max_goals: int) -> list[float]:
    return [
        math.exp(-mean) * mean**goals / math.factorial(goals)
        for goals in range(max_goals + 1)
    ]


def _low_score_correction(
    home_goals: int, away_goals: int, home_xg: float, away_xg: float, rho: float
) -> float:
    """The Dixon-Coles adjustment, which only touches 0-0, 0-1, 1-0 and 1-1."""
    if home_goals == 0 and away_goals == 0:
        factor = 1.0 - home_xg * away_xg * rho
    elif home_goals == 0 and away_goals == 1:
        factor = 1.0 + home_xg * rho
    elif home_goals == 1 and away_goals == 0:
        factor = 1.0 + away_xg * rho
    elif home_goals == 1 and away_goals == 1:
        factor = 1.0 - rho
    else:
        factor = 1.0

    return max(factor, 0.0)


def score_matrix(
    home_xg: float, away_xg: float, configuration: ModelConfiguration
) -> tuple[tuple[float, ...], ...]:
    """Independent Poisson scores, truncated at ``max_goals`` and renormalised."""
    home_pmf = _poisson_pmf(home_xg, configuration.max_goals)
    away_pmf = _poisson_pmf(away_xg, configuration.max_goals)
    rho = configuration.rho

    raw = [
        [
            home_pmf[h]
            * away_pmf[a]
            * (
                1.0
                if rho is None
                else _low_score_correction(h, a, home_xg, away_xg, rho)
            )
            for a in range(configuration.max_goals + 1)
        ]
        for h in range(configuration.max_goals + 1)
    ]

    total = sum(sum(row) for row in raw)

    if total <= 0:
        raise ValueError("The score matrix has no probability mass.")

    return tuple(tuple(cell / total for cell in row) for row in raw)


def calculate_probabilities(
    home: TeamStrength, away: TeamStrength, configuration: ModelConfiguration
) -> ProbabilityMatrix:
    home_xg, away_xg = expected_goals(home, away, configuration)

    return ProbabilityMatrix(
        home_xg=home_xg,
        away_xg=away_xg,
        max_goals=configuration.max_goals,
        cells=score_matrix(home_xg, away_xg, configuration),
    )


def outcome_probabilities(matrix: ProbabilityMatrix) -> tuple[float, float, float]:
    """``(home win, draw, away win)`` summed from the matrix."""
    home = draw = away = 0.0

    for home_goals, row in enumerate(matrix.cells):
        for away_goals, cell in enumerate(row):
            if home_goals > away_goals:
                home += cell
            elif home_goals == away_goals:
                draw += cell
            else:
                away += cell

    return home, draw, away
