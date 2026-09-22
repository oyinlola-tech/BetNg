from __future__ import annotations

import os
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from betng_service_kit import ServiceSettings, load_settings
from psycopg.conninfo import make_conninfo

SERVICE_NAME = "analytics"
SERVICE_VERSION = "0.1.0"
DEFAULT_PORT = 3009

SUMMARY_REFRESH_ENV = "ANALYTICS_SUMMARY_REFRESH_SECONDS"
REPORT_TIMEZONE_ENV = "ANALYTICS_REPORT_TIMEZONE"
DEFAULT_REPORT_TIMEZONE = "UTC"


def load_analytics_settings() -> ServiceSettings:
    return load_settings(SERVICE_NAME, SERVICE_VERSION)


def load_report_timezone() -> str:
    name = os.environ.get(REPORT_TIMEZONE_ENV) or DEFAULT_REPORT_TIMEZONE

    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise ValueError(
            f"{REPORT_TIMEZONE_ENV} is not a time zone: {name!r}."
        ) from error

    return name


def load_summary_refresh_seconds(default: int) -> int:
    """``0`` turns the summary off; otherwise 10 seconds to a day."""
    raw = os.environ.get(SUMMARY_REFRESH_ENV) or str(default)

    try:
        seconds = int(raw)
    except ValueError as error:
        raise ValueError(f"{SUMMARY_REFRESH_ENV} must be an integer.") from error

    if seconds != 0 and not 10 <= seconds <= 86_400:
        raise ValueError(f"{SUMMARY_REFRESH_ENV} must be 0 or 10..86400.")

    return seconds


def read_only_conninfo(database_url: str) -> str:
    """Second lock behind the SELECT-only grant: every transaction opens read-only."""
    return make_conninfo(database_url, options="-c default_transaction_read_only=on")
