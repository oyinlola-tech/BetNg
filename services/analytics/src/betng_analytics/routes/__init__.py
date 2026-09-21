from .admin_route import create_admin_router
from .internal_route import create_internal_router
from .shop_route import create_shop_router

API_PREFIX = "/api/v1"
INTERNAL_PREFIX = "/internal/analytics"

__all__ = [
    "API_PREFIX",
    "INTERNAL_PREFIX",
    "create_admin_router",
    "create_internal_router",
    "create_shop_router",
]
