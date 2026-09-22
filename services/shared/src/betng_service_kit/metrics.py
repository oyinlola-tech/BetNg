"""Prometheus text exposition matching ``packages/service-kit``'s metric names."""

from __future__ import annotations

import os
import resource
import threading
import time
from dataclasses import dataclass, field

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .errors import NOT_FOUND, build_error_body
from .internal_auth import is_internal_request
from .middleware import get_request_id

METRICS_PATH = "/metrics"
METRICS_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8"

BUCKETS: tuple[float, ...] = (
    0.005,
    0.01,
    0.025,
    0.05,
    0.1,
    0.25,
    0.5,
    1,
    2.5,
    5,
    10,
)

_STARTED_AT = time.time()


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def _number(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else repr(float(value))


@dataclass
class _Series:
    labels: str
    count: int = 0
    total: float = 0.0
    buckets: list[int] = field(default_factory=lambda: [0] * len(BUCKETS))


def _resident_bytes() -> int:
    try:
        with open("/proc/self/statm", encoding="ascii") as statm:
            pages = int(statm.read().split()[1])
        return pages * os.sysconf("SC_PAGE_SIZE")
    except (OSError, ValueError, IndexError):
        return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024


class MetricsRegistry:
    def __init__(self, service: str) -> None:
        self._service_label = f'service="{_escape(service)}"'
        self._series: dict[str, _Series] = {}
        self._lock = threading.Lock()

    def observe(self, method: str, route: str, status: int, seconds: float) -> None:
        labels = (
            f'{self._service_label},method="{_escape(method)}",'
            f'route="{_escape(route)}",status="{status}"'
        )
        with self._lock:
            entry = self._series.get(labels)
            if entry is None:
                entry = _Series(labels)
                self._series[labels] = entry
            entry.count += 1
            entry.total += seconds
            for index, bound in enumerate(BUCKETS):
                if seconds <= bound:
                    entry.buckets[index] += 1

    def render(self) -> str:
        with self._lock:
            series = [
                _Series(item.labels, item.count, item.total, list(item.buckets))
                for item in self._series.values()
            ]

        lines = [
            "# HELP http_requests_total HTTP requests served, by route template "
            "and status.",
            "# TYPE http_requests_total counter",
        ]
        lines.extend(
            f"http_requests_total{{{entry.labels}}} {entry.count}" for entry in series
        )
        lines.extend(
            [
                "# HELP http_request_duration_seconds HTTP request latency, by "
                "route template and status.",
                "# TYPE http_request_duration_seconds histogram",
            ]
        )
        for entry in series:
            lines.extend(
                f"http_request_duration_seconds_bucket{{{entry.labels},"
                f'le="{_number(bound)}"}} {entry.buckets[index]}'
                for index, bound in enumerate(BUCKETS)
            )
            lines.extend(
                [
                    f"http_request_duration_seconds_bucket{{{entry.labels},"
                    f'le="+Inf"}} {entry.count}',
                    f"http_request_duration_seconds_sum{{{entry.labels}}} "
                    f"{_number(entry.total)}",
                    f"http_request_duration_seconds_count{{{entry.labels}}} "
                    f"{entry.count}",
                ]
            )

        times = os.times()
        label = self._service_label
        lines.extend(
            [
                "# HELP process_cpu_seconds_total User and system CPU time spent.",
                "# TYPE process_cpu_seconds_total counter",
                f"process_cpu_seconds_total{{{label}}} "
                f"{_number(times.user + times.system)}",
                "# HELP process_resident_memory_bytes Resident memory size.",
                "# TYPE process_resident_memory_bytes gauge",
                f"process_resident_memory_bytes{{{label}}} {_resident_bytes()}",
                "# HELP process_start_time_seconds Process start time since the "
                "Unix epoch.",
                "# TYPE process_start_time_seconds gauge",
                f"process_start_time_seconds{{{label}}} {round(_STARTED_AT)}",
            ]
        )

        return "\n".join(lines) + "\n"


class MetricsMiddleware:
    """Labels by the matched route template, never the raw path."""

    def __init__(self, app: ASGIApp, registry: MetricsRegistry) -> None:
        self._app = app
        self._registry = registry

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return

        started_at = time.perf_counter()
        status = 500

        async def capture(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = int(message["status"])
            await send(message)

        try:
            await self._app(scope, receive, capture)
        finally:
            route = scope.get("route")
            template = getattr(route, "path", None)
            self._registry.observe(
                str(scope.get("method", "GET")),
                template if isinstance(template, str) else "unmatched",
                status,
                time.perf_counter() - started_at,
            )


def create_metrics_router(registry: MetricsRegistry) -> APIRouter:
    router = APIRouter(tags=["metrics"])

    @router.get(METRICS_PATH, include_in_schema=False)
    async def metrics(request: Request) -> Response:
        if not is_internal_request(request):
            return JSONResponse(
                status_code=404,
                content=build_error_body(
                    NOT_FOUND,
                    f"No route matches GET {METRICS_PATH}.",
                    get_request_id(request),
                ),
            )

        return Response(content=registry.render(), media_type=METRICS_CONTENT_TYPE)

    return router
