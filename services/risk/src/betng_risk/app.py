from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from betng_service_kit import (
    RpcClient,
    ServiceSettings,
    apply_migrations,
    create_pool,
    create_service_app,
    database_probe,
)
from fastapi import FastAPI

from .configs import (
    alert_interval_ms,
    limits_cache_ttl_ms,
    load_risk_settings,
    require_database_url,
)
from .constants import SCHEMA
from .controllers import RiskController
from .interfaces import AuditRecorder, SignalPublisher
from .loaders import load_container, load_services
from .procedures import create_risk_rpc_router, create_risk_rpc_server
from .repositories import (
    EventSignalPublisher,
    IdentityAuditRecorder,
    LimitsCache,
    PostgresRiskRepository,
    listen_for_limit_changes,
)
from .routes import create_admin_router, create_internal_router
from .services.risk.exposure_alerts import ExposureAlertMonitor, run_alert_job

DESCRIPTION = (
    "Decides, before betting closes, whether a stake is accepted, limited or "
    "rejected, from the global pending book and the limits in force. It can "
    "never alter a bet, a price, a match or a result, and it has no channel to "
    "the simulation."
)

MIGRATIONS_DIRECTORY = Path(__file__).parent / "migrations"


def create_app(
    settings: ServiceSettings | None = None,
    *,
    audit: AuditRecorder | None = None,
    signals: SignalPublisher | None = None,
    clock: Callable[[], datetime] | None = None,
    limits_cache_ms: int | None = None,
    alert_every_ms: int | None = None,
) -> FastAPI:
    """Build the application; the keyword arguments are seams for tests."""
    resolved = settings or load_risk_settings()
    logger = logging.getLogger(resolved.service_name)
    database_url = require_database_url(resolved)
    cache_ms = limits_cache_ttl_ms() if limits_cache_ms is None else limits_cache_ms
    sweep_ms = alert_interval_ms() if alert_every_ms is None else alert_every_ms

    pool = create_pool(database_url)
    limits_cache = LimitsCache(cache_ms / 1000)
    repository = PostgresRiskRepository(pool, logger, limits_cache)
    recorder = audit or IdentityAuditRecorder(
        RpcClient(
            resolved.identity_service_url, "identity", resolved.service_timeout_ms
        ),
        logger,
    )
    publisher = signals or EventSignalPublisher(
        RpcClient(resolved.event_service_url, "event", resolved.service_timeout_ms),
        logger,
    )
    monitor = ExposureAlertMonitor(repository, publisher, logger)

    container = load_container(repository, recorder, logger)
    command_bus, query_bus = load_services(container, clock)
    controller = RiskController(command_bus, query_bus)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        await pool.open()
        tasks: list[asyncio.Task[None]] = []
        try:
            await apply_migrations(pool, SCHEMA, MIGRATIONS_DIRECTORY, logger)
            if limits_cache.enabled:
                tasks.append(
                    asyncio.create_task(
                        listen_for_limit_changes(database_url, limits_cache, logger)
                    )
                )
            if sweep_ms > 0:
                tasks.append(
                    asyncio.create_task(run_alert_job(monitor, sweep_ms / 1000, logger))
                )
            yield
        finally:
            for task in tasks:
                task.cancel()
            for task in tasks:
                with contextlib.suppress(asyncio.CancelledError):
                    await task
            await pool.close()

    app = create_service_app(
        resolved,
        description=DESCRIPTION,
        routers=[
            create_risk_rpc_router(create_risk_rpc_server(command_bus)),
            create_internal_router(controller),
            create_admin_router(controller),
        ],
        probes=[database_probe(pool)],
        lifespan=lifespan,
    )
    app.state.alert_monitor = monitor
    app.state.limits_cache = limits_cache

    return app
