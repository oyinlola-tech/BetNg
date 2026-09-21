"""Service-local HTTP middleware.

Correlation, access logging and error rendering are shared by every BetNG
service and come from ``betng_service_kit``.
"""

from .request_context import bind_request_context, current_request_id

__all__ = ["bind_request_context", "current_request_id"]
