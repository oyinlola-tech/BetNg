"""Simulation service configuration.

The simulation service owns no database: it computes a result from the team
properties it is given and returns it. It therefore declares no database URL,
and readiness reports no database rather than a fictional one.
"""

from __future__ import annotations

from betng_service_kit import ServiceSettings, load_settings

SERVICE_NAME = "simulation"
SERVICE_VERSION = "0.1.0"
DEFAULT_PORT = 3005


def load_simulation_settings() -> ServiceSettings:
    """Read the simulation service configuration from the environment.

    Returns:
        The frozen settings.
    """
    return load_settings(SERVICE_NAME, SERVICE_VERSION)
