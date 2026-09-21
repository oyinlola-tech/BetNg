"""HTTP routers."""

from .admin_route import ADMIN_PREFIX, create_admin_router
from .internal_route import INTERNAL_PREFIX, create_internal_router

__all__ = [
    "ADMIN_PREFIX",
    "INTERNAL_PREFIX",
    "create_admin_router",
    "create_internal_router",
]
