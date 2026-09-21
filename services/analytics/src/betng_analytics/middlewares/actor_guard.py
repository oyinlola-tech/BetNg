"""Who may read a gateway-proxied report.

The gateway authenticates and forwards the actor; this re-checks the kind and
the permission, because a route that trusted the gateway's route table alone
would be open to anything else that can reach the service.
"""

from __future__ import annotations

from betng_service_kit import Actor, read_actor
from fastapi import Request

from ..constants import ACTOR_ADMIN, ACTOR_CASHIER
from ..errors import ForbiddenError, UnauthenticatedError


def _require(request: Request, kind: str, permission: str | None) -> Actor:
    actor = read_actor(request)

    if actor is None:
        raise UnauthenticatedError

    if actor.kind != kind:
        raise ForbiddenError

    if permission is not None and permission not in actor.permissions:
        raise ForbiddenError

    return actor


def require_admin(request: Request, permission: str | None = None) -> Actor:
    return _require(request, ACTOR_ADMIN, permission)


def require_shop_cashier(request: Request, permission: str) -> tuple[Actor, str]:
    """Return the cashier and the shop their reports are scoped to.

    The shop comes from the actor alone. A shop id in the query is never read.
    """
    actor = _require(request, ACTOR_CASHIER, permission)

    if actor.shop_id is None:
        raise ForbiddenError("This cashier is not attached to a shop.")

    return actor, actor.shop_id
