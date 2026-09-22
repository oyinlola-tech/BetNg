"""Per-calling-service token buckets in front of ``POST /rpc``."""

from __future__ import annotations

import json
import math
import os
import re
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass

from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from .internal_auth import CALLER_HEADER, is_internal_request
from .rpc import RPC_RATE_LIMITED

DEFAULT_RPC_RATE_PER_SECOND = 1000.0
DEFAULT_RPC_BURST = 2000
MAX_TRACKED_CALLERS = 64
UNKNOWN_CALLER = "unknown"

_CALLER = re.compile(r"^[a-z][a-z0-9-]{0,31}$")


def caller_name(raw: str | None) -> str:
    return raw if raw is not None and _CALLER.match(raw) else UNKNOWN_CALLER


@dataclass
class _Bucket:
    tokens: float
    updated_at: float


class CallerRateLimiter:
    def __init__(
        self,
        rate_per_second: float,
        burst: int,
        *,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if rate_per_second <= 0 or burst < 1:
            raise ValueError("A rate limit needs a positive rate and a burst of 1+.")
        self._rate = rate_per_second
        self._burst = float(burst)
        self._clock = clock
        self._buckets: dict[str, _Bucket] = {}

    def acquire(self, caller: str) -> float:
        """Take one token; return 0 when allowed, else seconds until one is free."""
        now = self._clock()
        key = (
            caller
            if caller in self._buckets or len(self._buckets) < MAX_TRACKED_CALLERS
            else UNKNOWN_CALLER
        )
        bucket = self._buckets.get(key)
        if bucket is None:
            bucket = _Bucket(tokens=self._burst, updated_at=now)
            self._buckets[key] = bucket

        bucket.tokens = min(
            self._burst, bucket.tokens + (now - bucket.updated_at) * self._rate
        )
        bucket.updated_at = now

        if bucket.tokens >= 1 - 1e-9:
            bucket.tokens -= 1
            return 0.0

        return (1 - bucket.tokens) / self._rate


def limiter_from_env(
    env: Mapping[str, str] | None = None,
) -> CallerRateLimiter | None:
    """Read ``RPC_RATE_LIMIT_PER_SECOND`` / ``RPC_RATE_LIMIT_BURST``; 0 disables."""
    source: Mapping[str, str] = os.environ if env is None else env
    raw_rate = source.get("RPC_RATE_LIMIT_PER_SECOND") or ""
    raw_burst = source.get("RPC_RATE_LIMIT_BURST") or ""

    try:
        rate = float(raw_rate) if raw_rate else DEFAULT_RPC_RATE_PER_SECOND
        burst = int(raw_burst) if raw_burst else DEFAULT_RPC_BURST
    except ValueError as error:
        raise ValueError(
            "RPC_RATE_LIMIT_PER_SECOND and RPC_RATE_LIMIT_BURST must be numbers."
        ) from error

    if not math.isfinite(rate) or rate < 0 or burst < 0:
        raise ValueError("RPC rate limits cannot be negative.")
    if rate == 0:
        return None

    return CallerRateLimiter(rate, max(burst, 1))


class RpcRateLimitMiddleware:
    """Only authenticated callers are counted; outsiders still get the 404."""

    def __init__(
        self, app: ASGIApp, limiter: CallerRateLimiter, path: str = "/rpc"
    ) -> None:
        self._app = app
        self._limiter = limiter
        self._path = path

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or scope.get("method") != "POST"
            or scope.get("path") != self._path
        ):
            await self._app(scope, receive, send)
            return

        request = Request(scope)
        if not is_internal_request(request):
            await self._app(scope, receive, send)
            return

        wait = self._limiter.acquire(caller_name(request.headers.get(CALLER_HEADER)))
        if wait <= 0:
            await self._app(scope, receive, send)
            return

        body = json.dumps(
            {
                "id": "",
                "success": False,
                "error": {
                    "code": RPC_RATE_LIMITED,
                    "message": "Too many RPC calls from this service.",
                },
            }
        ).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 429,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                    (b"retry-after", str(max(1, math.ceil(wait))).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})
