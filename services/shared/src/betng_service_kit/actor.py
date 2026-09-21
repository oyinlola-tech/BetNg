"""The authenticated actor asserted by the gateway; honoured only with the internal token."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import unquote

from fastapi import Request

from .internal_auth import is_internal_request

ACTOR_HEADERS = {
    "kind": "x-betng-actor-kind",
    "id": "x-betng-actor-id",
    "role": "x-betng-actor-role",
    "name": "x-betng-actor-name",
    "shop_id": "x-betng-shop-id",
    "permissions": "x-betng-permissions",
}


@dataclass(frozen=True)
class Actor:
    """Who is calling: ``CUSTOMER``, ``CASHIER``, ``ADMIN`` or ``SYSTEM``."""

    kind: str
    id: str
    role: str
    name: str
    shop_id: str | None
    permissions: frozenset[str]


def read_actor(request: Request) -> Actor | None:
    """Read the gateway-asserted actor, or ``None`` for an anonymous call."""
    if not is_internal_request(request):
        return None

    kind = request.headers.get(ACTOR_HEADERS["kind"])
    actor_id = request.headers.get(ACTOR_HEADERS["id"])

    if not kind or not actor_id:
        return None

    raw = request.headers.get(ACTOR_HEADERS["permissions"], "")

    return Actor(
        kind=kind,
        id=actor_id,
        role=request.headers.get(ACTOR_HEADERS["role"], ""),
        name=unquote(request.headers.get(ACTOR_HEADERS["name"], "")),
        shop_id=request.headers.get(ACTOR_HEADERS["shop_id"]) or None,
        permissions=frozenset(p for p in raw.split(",") if p),
    )
