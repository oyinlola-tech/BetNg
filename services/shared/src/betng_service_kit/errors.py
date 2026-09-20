"""The BetNG error envelope.

Every BetNG service, TypeScript and Python alike, answers a failure with::

    {"error": {"code": "...", "message": "...", "requestId": "..."}}

so a client can branch on the presence of an ``error`` key alone and needs no
knowledge of which half of the platform answered it.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from .middleware import get_request_id

VALIDATION_FAILED = "VALIDATION_FAILED"
NOT_FOUND = "NOT_FOUND"
METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED"
CONFLICT = "CONFLICT"
UPSTREAM_UNAVAILABLE = "UPSTREAM_UNAVAILABLE"
SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
INTERNAL_ERROR = "INTERNAL_ERROR"
#: The endpoint exists and its contract is fixed, but the engine behind it
#: is not built yet. Answered with 501 rather than a fabricated result.
NOT_IMPLEMENTED = "NOT_IMPLEMENTED"

OPAQUE_MESSAGE = "An unexpected error occurred."

_STATUS_CODES = {
    404: NOT_FOUND,
    405: METHOD_NOT_ALLOWED,
    409: CONFLICT,
    422: VALIDATION_FAILED,
    501: NOT_IMPLEMENTED,
    503: SERVICE_UNAVAILABLE,
}


class ServiceError(Exception):
    """A failure the service can describe to the client.

    Carrying the status, the machine-readable code and the message together
    means a handler raises one object and the HTTP layer needs no knowledge of
    the domain.
    """

    def __init__(
        self,
        message: str,
        *,
        code: str = INTERNAL_ERROR,
        status_code: int = 500,
        details: list[dict[str, str]] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details


def build_error_body(
    code: str,
    message: str,
    request_id: str,
    details: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    error: dict[str, Any] = {
        "code": code,
        "message": message,
        "requestId": request_id,
    }

    if details:
        error["details"] = details

    return {"error": error}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ServiceError)
    async def _service_error(
        request: Request, exc: ServiceError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=build_error_body(
                exc.code, exc.message, get_request_id(request), exc.details
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = [
            {
                "path": ".".join(str(part) for part in error["loc"][1:]),
                "message": error["msg"],
            }
            for error in exc.errors()
        ]

        return JSONResponse(
            status_code=422,
            content=build_error_body(
                VALIDATION_FAILED,
                "The request body failed validation.",
                get_request_id(request),
                details,
            ),
        )

    @app.exception_handler(HTTPException)
    async def _http_error(request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=build_error_body(
                _STATUS_CODES.get(exc.status_code, INTERNAL_ERROR),
                str(exc.detail),
                get_request_id(request),
            ),
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        # Unexpected: log the whole thing for us, tell the client nothing.
        import logging

        logging.getLogger(app.title).exception(
            "Unhandled error",
            extra={
                "requestId": get_request_id(request),
                "path": request.url.path,
                "method": request.method,
            },
        )

        return JSONResponse(
            status_code=500,
            content=build_error_body(
                INTERNAL_ERROR, OPAQUE_MESSAGE, get_request_id(request)
            ),
        )
