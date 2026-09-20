"""Environment-backed configuration for the odds service."""

from .service_config import (
    DEFAULT_PORT,
    SERVICE_NAME,
    SERVICE_VERSION,
    load_odds_settings,
)

__all__ = [
    "DEFAULT_PORT",
    "SERVICE_NAME",
    "SERVICE_VERSION",
    "load_odds_settings",
]
