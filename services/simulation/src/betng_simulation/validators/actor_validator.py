"""Server-side authorisation for the admin routes.

The gateway has already checked the permission, and this checks it again: a
route must not depend on the component in front of it for its own safety. It
runs as a route dependency, so an unauthorised caller is refused before the
body is even validated.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from betng_service_kit import Actor, read_actor
from fastapi import Request

from ..constants import ADMIN_ACTOR_KIND
from ..errors import ForbiddenError, UnauthenticatedError


def require_admin(permission: str) -> Callable[[Request], Awaitable[Actor]]:
    """Build the dependency that admits only an admin holding ``permission``."""

    async def dependency(request: Request) -> Actor:
        actor = read_actor(request)

        if actor is None:
            raise UnauthenticatedError

        if actor.kind != ADMIN_ACTOR_KIND or permission not in actor.permissions:
            raise ForbiddenError

        return actor

    return dependency
