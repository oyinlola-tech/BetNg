"""Service-local HTTP middleware.

Correlation, access logging and error rendering are shared by every BetNG
service and come from ``betng_service_kit``. What lives here is the actor
guard the admin routes use and the request context the RPC peers read.
"""

from .actor_guard import require_permission
from .request_context import RequestContextMiddleware, current_request_id

__all__ = ["RequestContextMiddleware", "current_request_id", "require_permission"]
