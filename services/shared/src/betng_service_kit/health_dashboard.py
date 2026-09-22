"""Unified health dashboard for all Python services.

Aggregates /health and /ready from simulation, odds, risk, and analytics
services into a single endpoint.
"""

from __future__ import annotations

import asyncio
import os
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import httpx
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

from .internal_auth import is_internal_request
from .middleware import get_request_id
from .errors import NOT_FOUND, build_error_body

DASHBOARD_PATH = "/admin/health/dashboard"
PROBE_TIMEOUT_SECONDS = 3.0

SERVICES = {
    "simulation": {"env_key": "SIMULATION_SERVICE_URL", "default": "http://localhost:8100"},
    "odds": {"env_key": "ODDS_SERVICE_URL", "default": "http://localhost:8200"},
    "risk": {"env_key": "RISK_SERVICE_URL", "default": "http://localhost:8300"},
    "analytics": {"env_key": "ANALYTICS_SERVICE_URL", "default": "http://localhost:8400"},
}


def _service_url(service: str) -> str:
    config = SERVICES[service]
    return os.environ.get(config["env_key"], config["default"])


@dataclass
class ServiceHealth:
    name: str
    status: str  # "ok", "degraded", "unavailable", "error"
    latency_ms: int
    url: str
    error: str | None = None
    version: str | None = None
    uptime_seconds: int | None = None
    dependencies: list[dict[str, Any]] = field(default_factory=list)


async def _probe_service(client: httpx.AsyncClient, name: str) -> ServiceHealth:
    url = _service_url(name)
    started = time.perf_counter()

    try:
        response = await client.get(f"{url}/health", timeout=PROBE_TIMEOUT_SECONDS)
        latency = int((time.perf_counter() - started) * 1000)

        if response.status_code == 200:
            data = response.json()
            return ServiceHealth(
                name=name,
                status="ok",
                latency_ms=latency,
                url=url,
                version=data.get("version"),
                uptime_seconds=data.get("uptimeSeconds"),
            )
        else:
            return ServiceHealth(
                name=name,
                status="degraded",
                latency_ms=latency,
                url=url,
                error=f"HTTP {response.status_code}",
            )

    except httpx.TimeoutException:
        latency = int((time.perf_counter() - started) * 1000)
        return ServiceHealth(
            name=name,
            status="unavailable",
            latency_ms=latency,
            url=url,
            error="timeout",
        )
    except Exception as exc:
        latency = int((time.perf_counter() - started) * 1000)
        return ServiceHealth(
            name=name,
            status="error",
            latency_ms=latency,
            url=url,
            error=str(exc)[:200],
        )


async def _probe_ready(client: httpx.AsyncClient, name: str) -> ServiceHealth:
    url = _service_url(name)
    started = time.perf_counter()

    try:
        response = await client.get(f"{url}/ready", timeout=PROBE_TIMEOUT_SECONDS)
        latency = int((time.perf_counter() - started) * 1000)

        if response.status_code == 200:
            data = response.json()
            return ServiceHealth(
                name=name,
                status=data.get("status", "ok"),
                latency_ms=latency,
                url=url,
                version=data.get("version"),
                dependencies=data.get("dependencies", []),
            )
        elif response.status_code == 503:
            data = response.json()
            return ServiceHealth(
                name=name,
                status="degraded",
                latency_ms=latency,
                url=url,
                dependencies=data.get("dependencies", []),
            )
        else:
            return ServiceHealth(
                name=name,
                status="degraded",
                latency_ms=latency,
                url=url,
                error=f"HTTP {response.status_code}",
            )

    except httpx.TimeoutException:
        latency = int((time.perf_counter() - started) * 1000)
        return ServiceHealth(
            name=name,
            status="unavailable",
            latency_ms=latency,
            url=url,
            error="timeout",
        )
    except Exception as exc:
        latency = int((time.perf_counter() - started) * 1000)
        return ServiceHealth(
            name=name,
            status="error",
            latency_ms=latency,
            url=url,
            error=str(exc)[:200],
        )


def _overall_status(services: list[ServiceHealth]) -> str:
    statuses = {s.status for s in services}
    if statuses == {"ok"}:
        return "ok"
    if "unavailable" in statuses or "error" in statuses:
        return "unavailable"
    return "degraded"


def create_health_dashboard_router() -> APIRouter:
    router = APIRouter(tags=["health-dashboard"])

    @router.get(DASHBOARD_PATH, include_in_schema=False)
    async def health_dashboard(request: Request, response: Response) -> dict[str, Any]:
        if not is_internal_request(request):
            return JSONResponse(
                status_code=404,
                content=build_error_body(
                    NOT_FOUND,
                    f"No route matches GET {DASHBOARD_PATH}.",
                    get_request_id(request),
                ),
            )

        async with httpx.AsyncClient() as client:
            health_results, ready_results = await asyncio.gather(
                asyncio.gather(*(_probe_service(client, name) for name in SERVICES)),
                asyncio.gather(*(_probe_ready(client, name) for name in SERVICES)),
            )

        services = {
            name: {
                "health": _to_dict(health),
                "ready": _to_dict(ready),
            }
            for name, health, ready in zip(SERVICES, health_results, ready_results)
        }

        overall = _overall_status(health_results)

        return {
            "status": overall,
            "timestamp": datetime.now(UTC).isoformat(),
            "services": services,
        }

    return router


def _to_dict(health: ServiceHealth) -> dict[str, Any]:
    result: dict[str, Any] = {
        "status": health.status,
        "latencyMs": health.latency_ms,
        "url": health.url,
    }
    if health.error is not None:
        result["error"] = health.error
    if health.version is not None:
        result["version"] = health.version
    if health.uptime_seconds is not None:
        result["uptimeSeconds"] = health.uptime_seconds
    if health.dependencies:
        result["dependencies"] = health.dependencies
    return result
