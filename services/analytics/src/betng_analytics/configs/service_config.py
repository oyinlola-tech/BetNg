"""Analytics service configuration.

The service owns no schema. It connects with ``ANALYTICS_DATABASE_URL``, whose
login is granted ``SELECT`` on every schema and nothing else.
"""

from __future__ import annotations

import os
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from betng_service_kit import ServiceSettings, load_settings
from psycopg.conninfo import make_conninfo

SERVICE_NAME = "analytics"
SERVICE_VERSION = "0.1.0"
DEFAULT_PORT = 3009

REPORT_TIMEZONE_ENV = "ANALYTICS_REPORT_TIMEZONE"
DEFAULT_REPORT_TIMEZONE = "UTC"


def load_analytics_settings() -> ServiceSettings:
    return load_settings(SERVICE_NAME, SERVICE_VERSION)


def load_report_timezone() -> str:
    """Return the zone calendar days and hours are cut in.

    Raises:
        ValueError: When the configured name is not an IANA zone, so a typo
            fails at startup instead of on the first report.
    """
    name = os.environ.get(REPORT_TIMEZONE_ENV) or DEFAULT_REPORT_TIMEZONE

    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise ValueError(
            f"{REPORT_TIMEZONE_ENV} is not a time zone: {name!r}."
        ) from error

    return name


def read_only_conninfo(database_url: str) -> str:
    """Make every transaction on the connection read-only.

    The login already lacks write privileges; this is the second lock, so a
    statement that tried to write is refused before the grant check.
    """
    return make_conninfo(
        database_url, options="-c default_transaction_read_only=on"
    )
