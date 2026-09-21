"""Re-checks the actor: the gateway's route table alone must not be the only guard."""

from __future__ import annotations

from collections.abc import Callable
from uuid import UUID

from betng_service_kit import Actor, read_actor
from fastapi import Request

from ..constants import ACTOR_ADMIN, ACTOR_CASHIER, REPORTS_READ
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


def admin_guard(permission: str | None = None) -> Callable[[Request], Actor]:
    """Check the actor as a dependency, before the query string is validated."""

    def guard(request: Request) -> Actor:
        return _require(request, ACTOR_ADMIN, permission)

    return guard


def shop_report_guard(request: Request) -> str:
    """Return the shop from the actor alone; a shop id in the query is never read."""
    actor = _require(request, ACTOR_CASHIER, REPORTS_READ)
    refusal = "This cashier is not attached to a shop."

    if actor.shop_id is None:
        raise ForbiddenError(refusal)

    try:
        return str(UUID(actor.shop_id))
    except ValueError:
        raise ForbiddenError(refusal) from None
