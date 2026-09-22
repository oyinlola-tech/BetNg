from __future__ import annotations

import os

from betng_service_kit import ServiceSettings, load_settings

SERVICE_NAME = "risk"
SERVICE_VERSION = "0.1.0"
DEFAULT_PORT = 3007
DEFAULT_LIMITS_CACHE_TTL_MS = 5_000
DEFAULT_ALERT_INTERVAL_MS = 10_000
MIN_ALERT_INTERVAL_MS = 1_000


def load_risk_settings() -> ServiceSettings:
    return load_settings(SERVICE_NAME, SERVICE_VERSION)


def require_database_url(settings: ServiceSettings) -> str:
    """Return the database URL or refuse to start without one."""
    url = settings.database_url

    if url is None:
        raise ValueError("RISK_DATABASE_URL is required.")

    return url


def _bounded_ms(name: str, default: int, maximum: int) -> int:
    raw = os.environ.get(name) or ""
    try:
        value = int(raw) if raw else default
    except ValueError as error:
        raise ValueError(f"{name} must be an integer.") from error
    if not 0 <= value <= maximum:
        raise ValueError(f"{name} must be between 0 and {maximum}.")
    return value


def limits_cache_ttl_ms() -> int:
    """``RISK_LIMITS_CACHE_TTL_MS``; 0 reads the limits on every decision."""
    return _bounded_ms("RISK_LIMITS_CACHE_TTL_MS", DEFAULT_LIMITS_CACHE_TTL_MS, 60_000)


def alert_interval_ms() -> int:
    """``RISK_ALERT_INTERVAL_MS``; 0 stops the exposure alert sweep."""
    value = _bounded_ms("RISK_ALERT_INTERVAL_MS", DEFAULT_ALERT_INTERVAL_MS, 3_600_000)
    if 0 < value < MIN_ALERT_INTERVAL_MS:
        raise ValueError(
            f"RISK_ALERT_INTERVAL_MS must be 0 or at least {MIN_ALERT_INTERVAL_MS}."
        )
    return value
