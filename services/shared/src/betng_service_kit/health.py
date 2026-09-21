from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import APIRouter, Response

from .config import ServiceSettings

PROBE_TIMEOUT_SECONDS = 2.0


@dataclass(frozen=True)
class DependencyProbe:
    name: str
    check: Callable[[], Awaitable[None]]
    #: An optional dependency degrades the service; a required one stops it.
    optional: bool = False


async def _run_probe(probe: DependencyProbe) -> dict[str, object]:
    started_at = time.perf_counter()

    try:
        await asyncio.wait_for(probe.check(), timeout=PROBE_TIMEOUT_SECONDS)
    except Exception as error:  # noqa: BLE001 - every failure is reportable
        # The reason goes to the log; a driver message can carry hosts and ports.
        logging.getLogger("betng.health").warning(
            "Dependency probe failed",
            extra={"probe": probe.name, "error": str(error)},
        )
        return {
            "name": probe.name,
            "status": "degraded" if probe.optional else "unavailable",
            "latencyMs": round((time.perf_counter() - started_at) * 1000),
            "error": "timeout"
            if isinstance(error, TimeoutError)
            else "unreachable",
        }

    return {
        "name": probe.name,
        "status": "ok",
        "latencyMs": round((time.perf_counter() - started_at) * 1000),
    }


def create_health_router(
    settings: ServiceSettings, probes: list[DependencyProbe]
) -> APIRouter:
    router = APIRouter(tags=["health"])
    started_at = time.monotonic()

    @router.get("/health")
    async def health() -> dict[str, object]:
        return {
            "status": "ok",
            "service": settings.service_name,
            "version": settings.version,
            "uptimeSeconds": round(time.monotonic() - started_at),
            "timestamp": datetime.now(UTC).isoformat(),
        }

    @router.get("/ready")
    async def ready(response: Response) -> dict[str, object]:
        dependencies = list(
            await asyncio.gather(*(_run_probe(probe) for probe in probes))
        )

        if any(entry["status"] == "unavailable" for entry in dependencies):
            status = "unavailable"
            response.status_code = 503
        elif any(entry["status"] == "degraded" for entry in dependencies):
            status = "degraded"
        else:
            status = "ok"

        return {
            "status": status,
            "service": settings.service_name,
            "version": settings.version,
            "timestamp": datetime.now(UTC).isoformat(),
            "dependencies": dependencies,
        }

    return router
