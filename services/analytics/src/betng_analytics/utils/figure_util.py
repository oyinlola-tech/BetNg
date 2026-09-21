from __future__ import annotations

from decimal import ROUND_HALF_EVEN, Decimal

_RATE_PLACES = Decimal("0.000001")


def operator_result(settled_stake: int, payout: int) -> int:
    """Settled stakes minus realised payouts; a negative result is reported as it is."""
    return settled_stake - payout


def rate(numerator: int, denominator: int) -> float:
    """``numerator / denominator`` to six places; 0 when there is no base."""
    if denominator == 0:
        return 0.0

    quotient = (Decimal(numerator) / Decimal(denominator)).quantize(
        _RATE_PLACES, rounding=ROUND_HALF_EVEN
    )

    return float(quotient)
