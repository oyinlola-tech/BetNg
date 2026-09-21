from __future__ import annotations

from pathlib import Path
from typing import Final

from betng_service_kit import ServiceSettings, load_settings

SERVICE_NAME = "odds"
SERVICE_VERSION = "0.1.0"
DEFAULT_PORT = 3006

DATABASE_SCHEMA: Final = "odds"
MIGRATIONS_DIRECTORY: Final = Path(__file__).resolve().parent.parent / "migrations"


def load_odds_settings() -> ServiceSettings:
    return load_settings(SERVICE_NAME, SERVICE_VERSION)


def require_database_url(settings: ServiceSettings) -> str:
    if settings.database_url is None:
        raise ValueError("ODDS_DATABASE_URL is required.")

    return settings.database_url
