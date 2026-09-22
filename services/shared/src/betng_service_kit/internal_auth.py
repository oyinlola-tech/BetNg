from __future__ import annotations

import hmac
import os

from fastapi import Request

INTERNAL_TOKEN_HEADER = "x-betng-internal-token"
#: Names the calling service; trusted only alongside a valid internal token.
CALLER_HEADER = "x-betng-caller"
MIN_TOKEN_LENGTH = 24
#: The placeholder in ``.env.example``: public, so refused in production.
DEVELOPMENT_PLACEHOLDER = "betng-local-development-internal-token"


def internal_token() -> str | None:
    """Return the configured token, or ``None`` when there is none."""
    return os.environ.get("INTERNAL_SERVICE_TOKEN") or None


def assert_internal_token_configured() -> None:
    """Refuse to run in production without a token, or anywhere with a weak one."""
    token = internal_token()

    if token is None:
        if os.environ.get("NODE_ENV") == "production":
            raise RuntimeError("INTERNAL_SERVICE_TOKEN must be set in production.")
        return

    if os.environ.get("NODE_ENV") == "production" and token == DEVELOPMENT_PLACEHOLDER:
        raise RuntimeError(
            "INTERNAL_SERVICE_TOKEN is still the development placeholder."
        )

    if len(token) < MIN_TOKEN_LENGTH:
        raise RuntimeError(
            f"INTERNAL_SERVICE_TOKEN must be at least {MIN_TOKEN_LENGTH} characters."
        )


_service_identity: str | None = None


def set_service_identity(name: str) -> None:
    global _service_identity
    _service_identity = name


def internal_headers() -> dict[str, str]:
    token = internal_token()
    headers = {} if token is None else {INTERNAL_TOKEN_HEADER: token}

    if _service_identity is not None:
        headers[CALLER_HEADER] = _service_identity

    return headers


def is_internal_request(request: Request) -> bool:
    expected = internal_token()

    if expected is None:
        return os.environ.get("NODE_ENV") != "production"

    presented = request.headers.get(INTERNAL_TOKEN_HEADER, "")

    return hmac.compare_digest(presented.encode(), expected.encode())


async def require_internal(request: Request) -> None:
    """FastAPI dependency for ``/internal`` routers: 404 for an outsider."""
    if not is_internal_request(request):
        from .errors import NOT_FOUND, ServiceError

        raise ServiceError("Not found.", code=NOT_FOUND, status_code=404)
