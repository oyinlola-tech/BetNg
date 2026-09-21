"""BetNG simulation service: the sole source of match results."""

from .app import create_app
from .configs import DEFAULT_PORT, SERVICE_NAME, SERVICE_VERSION

__all__ = ["DEFAULT_PORT", "SERVICE_NAME", "SERVICE_VERSION", "create_app"]
