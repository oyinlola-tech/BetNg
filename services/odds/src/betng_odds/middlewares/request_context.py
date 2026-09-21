from __future__ import annotations

from contextvars import ContextVar

from betng_service_kit import REQUEST_ID_HEADER
from starlette.types import ASGIApp, Receive, Scope, Send

_request_id: ContextVar[str | None] = ContextVar("odds_request_id", default=None)


def current_request_id() -> str | None:
    return _request_id.get()


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self._app = app
        self._header = REQUEST_ID_HEADER.lower().encode("latin-1")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return

        value = next(
            (raw for name, raw in scope["headers"] if name == self._header), None
        )
        token = _request_id.set(value.decode("latin-1") if value else None)

        try:
            await self._app(scope, receive, send)
        finally:
            _request_id.reset(token)
