"""HTTP routes."""

from .risk_route import (
    ADMIN_PREFIX,
    INTERNAL_PREFIX,
    create_admin_router,
    create_internal_router,
)

__all__ = [
    "ADMIN_PREFIX",
    "INTERNAL_PREFIX",
    "create_admin_router",
    "create_internal_router",
]
