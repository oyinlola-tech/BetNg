from __future__ import annotations

import logging
import re
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

REQUEST_ID_HEADER = "x-request-id"

_REQUEST_ID_STATE = "betng_request_id"

#: A client-supplied identifier is echoed back and written to logs, so it is
#: bounded and restricted to characters that cannot forge a header or corrupt
#: a log line. Anything else is replaced with a generated identifier.
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9_.:-]{8,128}$")

#: Probed constantly by an orchestrator, so logged at debug to keep them from
#: burying everything else.
_PROBE_PATHS = frozenset({"/health", "/ready"})


def get_request_id(request: Request) -> str:
    return getattr(request.state, _REQUEST_ID_STATE, "unknown")


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        inbound = request.headers.get(REQUEST_ID_HEADER)

        request_id = (
            inbound
            if inbound and _SAFE_REQUEST_ID.match(inbound)
            else str(uuid.uuid4())
        )

        setattr(request.state, _REQUEST_ID_STATE, request_id)

        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id

        return response


class AccessLogMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: FastAPI, logger_name: str) -> None:
        super().__init__(app)
        self._logger = logging.getLogger(logger_name)

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        level = (
            logging.DEBUG
            if request.url.path in _PROBE_PATHS
            else logging.INFO
        )

        context = {
            "requestId": get_request_id(request),
            "method": request.method,
            "path": request.url.path,
        }

        self._logger.log(level, "Request received", extra=context)
        started_at = time.perf_counter()

        # A request that raises must still produce a completion line, because
        # the failing requests are exactly the ones that must not be missing
        # from the log.
        try:
            response = await call_next(request)
        except Exception:
            self._logger.log(
                level,
                "Request failed before a response was produced",
                extra={
                    **context,
                    "durationMs": round((time.perf_counter() - started_at) * 1000),
                },
            )
            raise

        self._logger.log(
            level,
            "Request completed",
            extra={
                **context,
                "status": response.status_code,
                "durationMs": round((time.perf_counter() - started_at) * 1000),
            },
        )

        return response
