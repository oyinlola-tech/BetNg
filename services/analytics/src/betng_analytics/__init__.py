"""betng_analytics.

Read-only global bet analysis and reports.

Every figure this service answers is a SQL aggregate over the rows the other
services own, computed over the complete accepted-bet population. It owns no
schema and writes nothing: its database login can only ``SELECT``.
"""

from .app import create_app
from .configs import DEFAULT_PORT, SERVICE_NAME, SERVICE_VERSION

__all__ = ["DEFAULT_PORT", "SERVICE_NAME", "SERVICE_VERSION", "create_app"]
