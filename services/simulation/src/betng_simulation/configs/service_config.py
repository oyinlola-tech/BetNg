from __future__ import annotations

import os
from pathlib import Path

from betng_service_kit import ServiceSettings, load_settings

SERVICE_NAME = "simulation"
SERVICE_VERSION = "0.1.0"
DEFAULT_PORT = 3005
DATABASE_SCHEMA = "simulation"
DATABASE_URL_VARIABLE = "SIMULATION_DATABASE_URL"
IDENTITY_PEER = "identity"
SEED_VARIABLE_NAME = "SIMULATION_SEED_SECRET"
SEED_SECRET_MIN_LENGTH = 32
#: Public (it is in `.env.example`), so refused in production.
SEED_SECRET_PLACEHOLDER = "betng-local-development-seed-secret"
PRODUCTION = "production"
MIGRATIONS_DIRECTORY = Path(__file__).resolve().parent.parent / "migrations"


def load_simulation_settings() -> ServiceSettings:
    return load_settings(SERVICE_NAME, SERVICE_VERSION)


def require_database_url(settings: ServiceSettings) -> str:
    if not settings.database_url:
        raise ValueError(f"{DATABASE_URL_VARIABLE} must be set.")

    return settings.database_url


def load_seed_secret(environment: str) -> str | None:
    """Return the seed key; production refuses a missing, short or placeholder one."""
    secret = os.environ.get(SEED_VARIABLE_NAME) or None

    if environment != PRODUCTION:
        return secret

    if secret is None:
        raise ValueError(f"{SEED_VARIABLE_NAME} must be set in production.")

    if len(secret) < SEED_SECRET_MIN_LENGTH:
        raise ValueError(
            f"{SEED_VARIABLE_NAME} must be at least {SEED_SECRET_MIN_LENGTH} "
            "characters."
        )

    if secret == SEED_SECRET_PLACEHOLDER:
        raise ValueError(f"{SEED_VARIABLE_NAME} is still the development placeholder.")

    return secret
