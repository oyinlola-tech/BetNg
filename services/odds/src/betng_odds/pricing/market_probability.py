"""Score matrix to market probabilities.

The matrix is the simulation service's statement of how likely each score is.
This stage only adds cells up: it cannot make an outcome more or less likely,
which is what keeps price and probability separate concerns.
"""

from __future__ import annotations

import math
from decimal import ROUND_HALF_UP, Decimal
from typing import Final

from .market_catalogue import MarketSpec, build_catalogue
from .pricing_type import MarketProbabilities, SelectionProbability

PROBABILITY_QUANTUM: Final = Decimal("0.000001")


class InvalidScoreMatrixError(ValueError):
    """The matrix cannot be priced: empty, ragged, negative or summing to zero."""


def _validated_total(score_matrix: list[list[float]]) -> float:
    if not score_matrix or not score_matrix[0]:
        raise InvalidScoreMatrixError("The score matrix is empty.")

    width = len(score_matrix[0])

    for row in score_matrix:
        if len(row) != width:
            raise InvalidScoreMatrixError("The score matrix is not rectangular.")
        if any(not math.isfinite(cell) or cell < 0 for cell in row):
            raise InvalidScoreMatrixError("The score matrix holds an invalid cell.")

    total = math.fsum(cell for row in score_matrix for cell in row)

    if total <= 0:
        raise InvalidScoreMatrixError("The score matrix sums to zero.")

    return total


def _market_probabilities(
    spec: MarketSpec, score_matrix: list[list[float]], total: float
) -> MarketProbabilities:
    selections = []

    for selection in spec.selections:
        mass = math.fsum(
            cell
            for home_goals, row in enumerate(score_matrix)
            for away_goals, cell in enumerate(row)
            if selection.wins(home_goals, away_goals)
        )
        # The matrix is truncated at maxGoals, so it is renormalised by its
        # own total rather than assumed to sum to exactly one.
        probability = Decimal(repr(mass / total)).quantize(
            PROBABILITY_QUANTUM, rounding=ROUND_HALF_UP
        )
        selections.append(
            SelectionProbability(
                code=selection.code,
                label=selection.label,
                probability=min(max(probability, Decimal(0)), Decimal(1)),
            )
        )

    return MarketProbabilities(
        type=spec.type, name=spec.name, line=spec.line, selections=tuple(selections)
    )


def derive_market_probabilities(
    score_matrix: list[list[float]], home: str, away: str
) -> tuple[MarketProbabilities, ...]:
    """Return the probability of every selection of every market.

    ``score_matrix[h][a]`` is P(home scores h, away scores a). ``home`` and
    ``away`` are the short names used in the selection labels.
    """
    total = _validated_total(score_matrix)

    return tuple(
        _market_probabilities(spec, score_matrix, total)
        for spec in build_catalogue(home, away)
    )
