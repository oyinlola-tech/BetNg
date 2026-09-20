"""Environment-backed configuration for the risk service."""

from .service_config import (
    DEFAULT_PORT,
    SERVICE_NAME,
    SERVICE_VERSION,
    load_risk_settings,
)

__all__ = [
    "DEFAULT_PORT",
    "SERVICE_NAME",
    "SERVICE_VERSION",
    "load_risk_settings",
]
