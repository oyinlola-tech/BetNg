"""W3C Trace Context propagation without an OpenTelemetry SDK.

Each inbound request adopts a valid ``traceparent`` or starts a new trace; the
trace id is stamped on every log line and forwarded on every outbound call.
"""

from __future__ import annotations

import re
import secrets
from contextvars import ContextVar
from dataclasses import dataclass

from starlette.types import ASGIApp, Receive, Scope, Send

TRACEPARENT_HEADER = "traceparent"

_TRACEPARENT = re.compile(r"^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$")
_ZERO_TRACE = "0" * 32
_ZERO_SPAN = "0" * 16


@dataclass(frozen=True)
class TraceContext:
    trace_id: str
    span_id: str
    sampled: bool = True

    def child_traceparent(self) -> str:
        flags = "01" if self.sampled else "00"
        return f"00-{self.trace_id}-{secrets.token_hex(8)}-{flags}"


_CURRENT: ContextVar[TraceContext | None] = ContextVar(
    "betng_trace_context", default=None
)


def parse_traceparent(value: str | None) -> TraceContext | None:
    if not value:
        return None

    match = _TRACEPARENT.match(value.strip())
    if match is None:
        return None

    trace_id, parent_id, flags = match.groups()
    if trace_id == _ZERO_TRACE or parent_id == _ZERO_SPAN:
        return None

    return TraceContext(
        trace_id=trace_id, span_id=parent_id, sampled=int(flags, 16) & 1 == 1
    )


def new_trace() -> TraceContext:
    return TraceContext(trace_id=secrets.token_hex(16), span_id=secrets.token_hex(8))


def current_trace() -> TraceContext | None:
    return _CURRENT.get()


def current_trace_id() -> str | None:
    context = _CURRENT.get()
    return None if context is None else context.trace_id


def outbound_trace_headers() -> dict[str, str]:
    context = _CURRENT.get() or new_trace()
    return {TRACEPARENT_HEADER: context.child_traceparent()}


def bind_trace(context: TraceContext | None) -> None:
    _CURRENT.set(context)


class TraceMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self._app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return

        inbound: str | None = None
        for name, value in scope.get("headers", []):
            if name == b"traceparent":
                inbound = value.decode("latin-1")
                break

        parent = parse_traceparent(inbound)
        context = (
            TraceContext(
                trace_id=parent.trace_id,
                span_id=secrets.token_hex(8),
                sampled=parent.sampled,
            )
            if parent is not None
            else new_trace()
        )

        token = _CURRENT.set(context)
        try:
            await self._app(scope, receive, send)
        finally:
            _CURRENT.reset(token)
