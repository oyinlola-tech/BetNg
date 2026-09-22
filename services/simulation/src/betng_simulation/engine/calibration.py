"""Market probabilities and scoring rules used to check the model's calibration."""

from __future__ import annotations

import math
from collections.abc import Callable, Iterable, Sequence
from typing import Final

Cells = Sequence[Sequence[float]]
Score = tuple[int, int]

TOTAL_GOALS_LINES: Final = (1.5, 2.5, 3.5)
CORRECT_SCORE_MAX_GOALS: Final = 3
LOG_LOSS_FLOOR: Final = 1e-12

Outcome = Callable[[int, int], bool]


def _over(line: float) -> Outcome:
    return lambda home, away: home + away > line


def _exact(home_goals: int, away_goals: int) -> Outcome:
    return lambda home, away: home == home_goals and away == away_goals


OUTCOMES: Final[dict[str, Outcome]] = {
    "HOME": lambda home, away: home > away,
    "DRAW": lambda home, away: home == away,
    "AWAY": lambda home, away: home < away,
    "BTTS_YES": lambda home, away: home > 0 and away > 0,
    "HOME_MINUS_1_5": lambda home, away: home - away > 1.5,
    **{
        f"OVER_{str(line).replace('.', '_')}": _over(line) for line in TOTAL_GOALS_LINES
    },
    **{
        f"CS_{home}_{away}": _exact(home, away)
        for home in range(CORRECT_SCORE_MAX_GOALS + 1)
        for away in range(CORRECT_SCORE_MAX_GOALS + 1)
    },
}


def market_probabilities(cells: Cells) -> dict[str, float]:
    """Return P(outcome) for every tracked selection under a score matrix."""
    return {
        name: math.fsum(
            cell
            for home, row in enumerate(cells)
            for away, cell in enumerate(row)
            if wins(home, away)
        )
        for name, wins in OUTCOMES.items()
    }


def outcome_frequencies(scores: Iterable[Score]) -> dict[str, float]:
    observed = list(scores)
    if not observed:
        raise ValueError("No scores to count.")

    return {
        name: sum(1 for home, away in observed if wins(home, away)) / len(observed)
        for name, wins in OUTCOMES.items()
    }


def result_index(score: Score) -> int:
    home, away = score
    return 0 if home > away else 1 if home == away else 2


def brier_score(forecasts: Sequence[Sequence[float]], outcomes: Sequence[int]) -> float:
    """Return the mean multi-class Brier score; lower is better."""
    if len(forecasts) != len(outcomes) or not outcomes:
        raise ValueError("Forecasts and outcomes must be non-empty and aligned.")

    return math.fsum(
        math.fsum(
            (probability - (1.0 if index == outcome else 0.0)) ** 2
            for index, probability in enumerate(forecast)
        )
        for forecast, outcome in zip(forecasts, outcomes, strict=True)
    ) / len(outcomes)


def log_loss(forecasts: Sequence[Sequence[float]], outcomes: Sequence[int]) -> float:
    """Return the mean negative log-likelihood of the observed outcomes."""
    if len(forecasts) != len(outcomes) or not outcomes:
        raise ValueError("Forecasts and outcomes must be non-empty and aligned.")

    return -math.fsum(
        math.log(max(forecast[outcome], LOG_LOSS_FLOOR))
        for forecast, outcome in zip(forecasts, outcomes, strict=True)
    ) / len(outcomes)


def expected_brier_score(forecast: Sequence[float]) -> float:
    """Return the Brier score a calibrated forecast earns on its own outcomes."""
    return math.fsum(p * (1.0 - p) for p in forecast)


def calibration_tolerance(
    probability: float, simulations: int, runs: int, sigmas: float = 4.0
) -> float:
    """Return the two-sample tolerance for comparing two binomial estimates."""
    variance = probability * (1.0 - probability) * (1.0 / simulations + 1.0 / runs)

    return sigmas * math.sqrt(max(variance, 1.0 / (simulations * runs)))
