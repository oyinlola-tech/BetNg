from __future__ import annotations

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo


def to_iso(moment: datetime) -> str:
    """Format as the contracts' ``isoTimestampSchema`` expects: UTC with ``Z``."""
    return (
        moment.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    )


def to_iso_or_none(moment: datetime | None) -> str | None:
    return None if moment is None else to_iso(moment)


def as_utc(moment: datetime | None) -> datetime | None:
    """Read a bound given without an offset as UTC rather than local time."""
    if moment is None:
        return None

    if moment.tzinfo is None:
        return moment.replace(tzinfo=UTC)

    return moment


def now() -> datetime:
    return datetime.now(UTC)


def today_in(zone: str) -> date:
    return datetime.now(ZoneInfo(zone)).date()
