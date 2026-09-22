"""REST GETs to a peer: breaker-guarded, traced, and deduplicated while in flight."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

import httpx

from .errors import UPSTREAM_UNAVAILABLE, ServiceError
from .internal_auth import internal_headers
from .resilience import (
    BreakerSettings,
    CircuitBreaker,
    CircuitOpenError,
    InFlightDeduplicator,
    breaker_for,
    freeze_params,
)
from .tracing import outbound_trace_headers


@dataclass(frozen=True)
class PeerResponse:
    status: int
    data: Any


class PeerClient:
    def __init__(
        self,
        base_url: str,
        peer: str,
        timeout_ms: int,
        *,
        breaker: CircuitBreaker | None = None,
        breaker_settings: BreakerSettings | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._peer = peer
        self._timeout = timeout_ms / 1000
        self._breaker = breaker or breaker_for(peer, breaker_settings)
        self._transport = transport
        self._inflight: InFlightDeduplicator[PeerResponse] = InFlightDeduplicator()

    @property
    def breaker(self) -> CircuitBreaker:
        return self._breaker

    def inflight(self) -> int:
        return self._inflight.pending()

    async def get(
        self,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
        headers: Mapping[str, str] | None = None,
        request_id: str | None = None,
    ) -> PeerResponse:
        """Identical GETs (path, query and headers) in flight share one call."""
        if not path.startswith("/") or path.startswith("//"):
            raise ValueError("A peer path must be absolute and on the peer's host.")

        forwarded = dict(headers or {})
        key = (path, freeze_params(params), tuple(sorted(forwarded.items())))

        return await self._inflight.run(
            key, lambda: self._send(path, params, forwarded, request_id)
        )

    async def _send(
        self,
        path: str,
        params: Mapping[str, Any] | None,
        headers: dict[str, str],
        request_id: str | None,
    ) -> PeerResponse:
        try:
            self._breaker.before_call()
        except CircuitOpenError as error:
            raise self._unavailable("is failing; calls are paused") from error

        outbound = {
            "accept": "application/json",
            **headers,
            **internal_headers(),
            **outbound_trace_headers(),
        }
        if request_id is not None:
            outbound["x-request-id"] = request_id

        try:
            async with httpx.AsyncClient(
                timeout=self._timeout, transport=self._transport
            ) as client:
                response = await client.get(
                    self._base_url + path,
                    params=dict(params) if params else None,
                    headers=outbound,
                )
        except httpx.TimeoutException as error:
            self._breaker.record_failure()
            raise self._unavailable(
                f"did not respond within {int(self._timeout * 1000)}ms"
            ) from error
        except httpx.HTTPError as error:
            self._breaker.record_failure()
            raise self._unavailable("could not be reached") from error
        except BaseException:
            self._breaker.release_probe()
            raise

        if response.status_code >= 500:
            self._breaker.record_failure()
        else:
            self._breaker.record_success()

        content_type = response.headers.get("content-type", "")
        data: Any = (
            response.json()
            if response.content and "application/json" in content_type
            else response.text
        )

        return PeerResponse(status=response.status_code, data=data)

    def _unavailable(self, reason: str) -> ServiceError:
        return ServiceError(
            f"The {self._peer} service {reason}.",
            code=UPSTREAM_UNAVAILABLE,
            status_code=503,
        )
