from __future__ import annotations

from betng_service_kit import ServiceSettings, load_settings

SERVICE_NAME = "risk"
SERVICE_VERSION = "0.1.0"
DEFAULT_PORT = 3007


def load_risk_settings() -> ServiceSettings:
    return load_settings(SERVICE_NAME, SERVICE_VERSION)


def require_database_url(settings: ServiceSettings) -> str:
    """Return the database URL or refuse to start without one."""
    url = settings.database_url

    if url is None:
        raise ValueError("RISK_DATABASE_URL is required.")

    return url
