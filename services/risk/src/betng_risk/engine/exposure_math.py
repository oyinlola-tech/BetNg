from __future__ import annotations

from collections.abc import Callable, Iterable, Sequence
from decimal import ROUND_DOWN, Decimal
from typing import Literal

UtilisationStatus = Literal["NORMAL", "ELEVATED", "CRITICAL"]

ELEVATED_PERCENT = 50
CRITICAL_PERCENT = 85


def odds_hundredths(odds: Decimal) -> int:
    return int((odds * 100).to_integral_value(rounding=ROUND_DOWN))


def odds_fraction(legs_odds: Sequence[Decimal]) -> tuple[int, int]:
    numerator = 1
    for odds in legs_odds:
        numerator *= odds_hundredths(odds)

    return numerator, 100 ** len(legs_odds)


def total_odds(numerator: int, denominator: int) -> Decimal:
    return Decimal(numerator * 100 // denominator) / Decimal(100)


def potential_payout(stake: int, numerator: int, denominator: int) -> int:
    """Return ``floor(stake * total odds)`` in kobo."""
    return stake * numerator // denominator


def largest_stake(allowed: Callable[[int], bool], upper: int) -> int:
    if upper <= 0 or not allowed(0):
        return 0

    if allowed(upper):
        return upper

    low, high = 0, upper
    while high - low > 1:
        middle = (low + high) // 2
        if allowed(middle):
            low = middle
        else:
            high = middle

    return low


def utilisation_status(pairs: Iterable[tuple[int, int]]) -> UtilisationStatus:
    status: UtilisationStatus = "NORMAL"

    for value, limit in pairs:
        if value * 100 > CRITICAL_PERCENT * limit:
            return "CRITICAL"
        if value * 100 >= ELEVATED_PERCENT * limit:
            status = "ELEVATED"

    return status
