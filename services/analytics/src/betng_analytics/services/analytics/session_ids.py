"""Session ids are derived from what a session covers; formats are in the README."""

from __future__ import annotations

import re
from datetime import UTC, datetime

_UNSAFE = re.compile(r"[^A-Za-z0-9]+")


def _token(value: object) -> str:
    return _UNSAFE.sub("", str(value)).upper()


def hour_session_id(day_code: str, hour: int) -> str:
    return f"SESSION-{day_code}-{hour + 1:04d}"


def day_session_id(day_code: str) -> str:
    return f"SESSION-{day_code}"


def round_session_id(kind: str, league_code: str, season: object, matchday: int) -> str:
    unit = "MD" if kind == "MATCHDAY" else "R"

    return f"SESSION-{_token(league_code)}-S{_token(season)}-{unit}{matchday:02d}"


def custom_session_id(starts_at: datetime, ends_at: datetime) -> str:
    def stamp(moment: datetime) -> str:
        return moment.astimezone(UTC).strftime("%Y%m%dT%H%MZ")

    return f"SESSION-{stamp(starts_at)}-{stamp(ends_at)}"
