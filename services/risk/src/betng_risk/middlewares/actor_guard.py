from __future__ import annotations

from collections.abc import Callable

from betng_service_kit import Actor, read_actor
from fastapi import Request

from ..constants import ADMIN_ACTOR_KIND
from ..errors import ForbiddenError, UnauthenticatedError


def require_admin(permissions: frozenset[str]) -> Callable[[Request], Actor]:
    """Build a dependency that admits an admin holding one of ``permissions``."""

    def dependency(request: Request) -> Actor:
        actor = read_actor(request)

        if actor is None:
            raise UnauthenticatedError
        if actor.kind != ADMIN_ACTOR_KIND or not (actor.permissions & permissions):
            raise ForbiddenError

        return actor

    return dependency
