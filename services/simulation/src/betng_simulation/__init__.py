"""betng_simulation.

Team strength, match probability, score generation, match events and the
virtual match timeline.

The simulation engine is the sole source of a match result. It runs only after
betting has closed, and its inputs are team properties and the fixture — never
the book's position or any bettor's exposure.
"""

from .app import create_app
from .configs import DEFAULT_PORT, SERVICE_NAME, SERVICE_VERSION

__all__ = ["DEFAULT_PORT", "SERVICE_NAME", "SERVICE_VERSION", "create_app"]
