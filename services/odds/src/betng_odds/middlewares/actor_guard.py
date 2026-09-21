"""Permission checks against the gateway-asserted actor."""

from __future__ import annotations

from collections.abc import Callable

from betng_service_kit import Actor, read_actor
from fastapi import Request

from ..errors import ForbiddenError, UnauthenticatedError


def require_permission(permission: str) -> Callable[[Request], Actor]:
    """Build a FastAPI dependency that yields the actor holding ``permission``.

    The gateway already checked; the service re-checks so a route is never
    protected by its proxy alone.
    """

    def dependency(request: Request) -> Actor:
        actor = read_actor(request)

        if actor is None:
            raise UnauthenticatedError

        if permission not in actor.permissions:
            raise ForbiddenError(permission)

        return actor

    return dependency
