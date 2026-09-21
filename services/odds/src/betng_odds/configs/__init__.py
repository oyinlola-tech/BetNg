"""Service configuration."""

from .service_config import (
    DATABASE_SCHEMA,
    DEFAULT_PORT,
    MIGRATIONS_DIRECTORY,
    SERVICE_NAME,
    SERVICE_VERSION,
    load_odds_settings,
    require_database_url,
)

__all__ = [
    "DATABASE_SCHEMA",
    "DEFAULT_PORT",
    "MIGRATIONS_DIRECTORY",
    "SERVICE_NAME",
    "SERVICE_VERSION",
    "load_odds_settings",
    "require_database_url",
]
