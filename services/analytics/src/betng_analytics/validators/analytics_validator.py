"""Bounds every analytics query must satisfy before it reaches the database."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from ..constants import DEFAULT_REPORT_DAYS, MAX_REPORT_DAYS
from ..errors import InvalidQueryError
from ..types import DayRange, Window
from ..utils import as_utc, today_in

_DAY_LENGTH = len("2026-09-21")
_MAX_DAY_TEXT = 40


def validate_window(start: datetime | None, end: datetime | None) -> Window:
    """Build the half-open ``placed_at`` window a figure covers."""
    window = Window(start=as_utc(start), end=as_utc(end))

    if (
        window.start is not None
        and window.end is not None
        and window.start >= window.end
    ):
        raise InvalidQueryError("to", "`to` must be later than `from`.")

    return window


def parse_day(path: str, value: str, zone: str) -> date:
    """Read ``YYYY-MM-DD``, or an ISO timestamp as its day in the report zone."""
    if len(value) > _MAX_DAY_TEXT:
        raise InvalidQueryError(path, "Expected a date or an ISO timestamp.")

    try:
        if len(value) == _DAY_LENGTH:
            return date.fromisoformat(value)

        moment = datetime.fromisoformat(value)
    except ValueError:
        raise InvalidQueryError(
            path, "Expected a date (YYYY-MM-DD) or an ISO timestamp."
        ) from None

    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)

    return moment.astimezone(ZoneInfo(zone)).date()


def validate_days(first: str | None, last: str | None, zone: str) -> DayRange:
    """Resolve a report's day range; it defaults to the week ending today."""
    last_day = today_in(zone) if last is None else parse_day("to", last, zone)
    first_day = (
        last_day - timedelta(days=DEFAULT_REPORT_DAYS - 1)
        if first is None
        else parse_day("from", first, zone)
    )

    if first_day > last_day:
        raise InvalidQueryError("to", "`to` must not be earlier than `from`.")

    if (last_day - first_day).days >= MAX_REPORT_DAYS:
        raise InvalidQueryError(
            "from", f"A report covers at most {MAX_REPORT_DAYS} days."
        )

    return DayRange(first=first_day, last=last_day)


def validate_day(value: str | None, zone: str) -> DayRange:
    day = today_in(zone) if value is None else parse_day("date", value, zone)

    return DayRange(first=day, last=day)
