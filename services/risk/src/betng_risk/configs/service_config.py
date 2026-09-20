"""Risk service configuration.

The risk service owns no database in this phase: it is handed a market's
accepted stakes and returns an analysis. It therefore declares no database
URL, and readiness reports no database rather than a fictional one.
"""

from __future__ import annotations

from betng_service_kit import ServiceSettings, load_settings

SERVICE_NAME = "risk"
SERVICE_VERSION = "0.1.0"
DEFAULT_PORT = 3007


def load_risk_settings() -> ServiceSettings:
    """Read the risk service configuration from the environment.

    Returns:
        The frozen settings.
    """
    return load_settings(SERVICE_NAME, SERVICE_VERSION)
