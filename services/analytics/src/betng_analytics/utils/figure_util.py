"""The two derived figures, defined once.

Everything else this service reports is a SQL aggregate. These two are
arithmetic over such aggregates, kept here so every route derives them the
same way.
"""

from __future__ import annotations

from decimal import ROUND_HALF_EVEN, Decimal

_RATE_PLACES = Decimal("0.000001")


def operator_result(settled_stake: int, payout: int) -> int:
    """Stakes of won and lost bets minus what was paid on the won ones.

    Negative when payouts exceed stakes, and reported as it is.
    """
    return settled_stake - payout


def rate(numerator: int, denominator: int) -> float:
    """``numerator / denominator`` to six places; 0 when there is no base."""
    if denominator == 0:
        return 0.0

    quotient = (Decimal(numerator) / Decimal(denominator)).quantize(
        _RATE_PLACES, rounding=ROUND_HALF_EVEN
    )

    return float(quotient)
