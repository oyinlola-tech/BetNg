"""betng_risk.

Exposure, liability, potential payouts, risk limits and worst-case outcome
analysis.

The risk service is how BetNG controls its book: by repricing or suspending a
market while betting is still open. It has no command side and no channel to
the simulation, so it cannot alter a bet, a price or a result.
"""

from .app import create_app
from .configs import DEFAULT_PORT, SERVICE_NAME, SERVICE_VERSION

__all__ = ["DEFAULT_PORT", "SERVICE_NAME", "SERVICE_VERSION", "create_app"]
