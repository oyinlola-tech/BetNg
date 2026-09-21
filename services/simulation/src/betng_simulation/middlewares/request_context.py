"""The current request's correlation id, for code below the HTTP layer."""

from __future__ import annotations

from contextvars import ContextVar

from betng_service_kit import get_request_id
from fastapi import Request

_UNKNOWN_REQUEST_ID = "unknown"

_request_id: ContextVar[str] = ContextVar(
    "betng_simulation_request_id", default=_UNKNOWN_REQUEST_ID
)


async def bind_request_context(request: Request) -> None:
    """Bind the request id for code below the HTTP layer."""
    _request_id.set(get_request_id(request))


def current_request_id() -> str:
    """Return the bound request id."""
    return _request_id.get()
