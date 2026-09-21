from __future__ import annotations

from contextvars import ContextVar

from betng_service_kit import get_request_id
from fastapi import Request

_UNKNOWN_REQUEST_ID = "unknown"

_request_id: ContextVar[str] = ContextVar(
    "betng_simulation_request_id", default=_UNKNOWN_REQUEST_ID
)


async def bind_request_context(request: Request) -> None:
    _request_id.set(get_request_id(request))


def current_request_id() -> str:
    return _request_id.get()
