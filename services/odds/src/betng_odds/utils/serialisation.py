"""Conversions from stored values to their JSON forms."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal


def iso_timestamp(value: datetime) -> str:
    """Render an instant as the contract's ISO-8601 UTC string with a ``Z``."""
    return (
        value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    )


def to_number(value: Decimal) -> float:
    """Render a stored ``NUMERIC`` as a JSON number.

    Prices are computed and stored as ``Decimal``; the float exists only at
    the wire, where the shortest repr of a 2 dp value is that value.
    """
    return float(value)
