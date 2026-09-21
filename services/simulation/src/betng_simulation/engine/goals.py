"""Score sampling."""

from __future__ import annotations

import random

from .models import ProbabilityMatrix


def sample_score(rng: random.Random, matrix: ProbabilityMatrix) -> tuple[int, int]:
    """Draw ``(home_goals, away_goals)`` from the matrix by inverse CDF."""
    target = rng.random()
    cumulative = 0.0
    last_possible: tuple[int, int] | None = None

    for home_goals, row in enumerate(matrix.cells):
        for away_goals, cell in enumerate(row):
            if cell <= 0:
                continue

            cumulative += cell
            last_possible = (home_goals, away_goals)

            if target < cumulative:
                return last_possible

    # Floating-point shortfall: the cells sum to 1 only within rounding.
    if last_possible is None:
        raise ValueError("The score matrix has no probability mass.")

    return last_possible
