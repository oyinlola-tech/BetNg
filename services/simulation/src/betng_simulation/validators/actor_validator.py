"""Authorisation for admin routes, re-checked here and run before validation."""

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
