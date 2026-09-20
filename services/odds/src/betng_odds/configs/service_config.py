"""Odds service configuration.

The odds service owns no database in this phase: it prices from the
probabilities the simulation service produces. It therefore declares no
database URL, and readiness reports no database rather than a fictional one.
"""

from __future__ import annotations

from betng_service_kit import ServiceSettings, load_settings

SERVICE_NAME = "odds"
SERVICE_VERSION = "0.1.0"
DEFAULT_PORT = 3006


def load_odds_settings() -> ServiceSettings:
    """Read the odds service configuration from the environment.

    Returns:
        The frozen settings.
    """
    return load_settings(SERVICE_NAME, SERVICE_VERSION)
