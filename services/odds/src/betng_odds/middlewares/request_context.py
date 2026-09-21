"""The correlation identifier of the request being served."""

from __future__ import annotations

from contextvars import ContextVar

from betng_service_kit import REQUEST_ID_HEADER
from starlette.types import ASGIApp, Receive, Scope, Send

_request_id: ContextVar[str | None] = ContextVar("odds_request_id", default=None)


def current_request_id() -> str | None:
    """Return the inbound ``x-request-id``, when the caller sent one."""
    return _request_id.get()


class RequestContextMiddleware:
    """Expose the inbound correlation header to code below the HTTP layer."""

    def __init__(self, app: ASGIApp) -> None:
        """Wrap the next ASGI application."""
        self._app = app
        self._header = REQUEST_ID_HEADER.lower().encode("latin-1")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Bind the header for the duration of one request."""
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
