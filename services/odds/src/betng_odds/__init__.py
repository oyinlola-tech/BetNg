"""betng_odds.

Probability-to-price conversion: market generation, odds calculation and
odds updates.

The odds service owns price. The simulation service owns probability. Keeping
them apart means the book's margin can never quietly become a change to how
likely an outcome is.
"""

from .app import create_app
from .configs import DEFAULT_PORT, SERVICE_NAME, SERVICE_VERSION

__all__ = ["DEFAULT_PORT", "SERVICE_NAME", "SERVICE_VERSION", "create_app"]
