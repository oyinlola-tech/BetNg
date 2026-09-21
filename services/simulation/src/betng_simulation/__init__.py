"""betng_simulation.

The probability model, and the result and timeline of every virtual match.

The simulation engine is the sole source of a match result. Its inputs are the
match id, the two teams' properties and the model configuration, never the
book's position or any bettor's exposure, and each result is stored once, in
the ``simulation`` schema, where the database refuses to change it.
"""

from .app import create_app
from .configs import DEFAULT_PORT, SERVICE_NAME, SERVICE_VERSION

__all__ = ["DEFAULT_PORT", "SERVICE_NAME", "SERVICE_VERSION", "create_app"]
