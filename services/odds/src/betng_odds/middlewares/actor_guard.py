"""Permission checks against the gateway-asserted actor."""

from __future__ import annotations

from collections.abc import Callable

from betng_service_kit import Actor, read_actor
from fastapi import Request

from ..errors import ForbiddenError, UnauthenticatedError

ADMIN_ACTOR_KIND = "ADMIN"


def require_permission(permission: str) -> Callable[[Request], Actor]:
    """Build a FastAPI dependency that yields the admin holding ``permission``."""

    def dependency(request: Request) -> Actor:
        actor = read_actor(request)

        if actor is None:
            raise UnauthenticatedError

        if actor.kind != ADMIN_ACTOR_KIND or permission not in actor.permissions:
            raise ForbiddenError(permission)

        return actor

    return dependency
