"""Simulation service configuration."""

from __future__ import annotations

from pathlib import Path

from betng_service_kit import ServiceSettings, load_settings

SERVICE_NAME = "simulation"
SERVICE_VERSION = "0.1.0"
DEFAULT_PORT = 3005
DATABASE_SCHEMA = "simulation"
DATABASE_URL_VARIABLE = "SIMULATION_DATABASE_URL"
IDENTITY_PEER = "identity"
MIGRATIONS_DIRECTORY = Path(__file__).resolve().parent.parent / "migrations"


def load_simulation_settings() -> ServiceSettings:
    """Load the service settings."""
    return load_settings(SERVICE_NAME, SERVICE_VERSION)


def require_database_url(settings: ServiceSettings) -> str:
    """Return the database URL."""
    if not settings.database_url:
        raise ValueError(f"{DATABASE_URL_VARIABLE} must be set.")

    return settings.database_url
