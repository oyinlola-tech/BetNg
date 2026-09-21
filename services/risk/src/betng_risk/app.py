"""Assembles the risk service."""

from __future__ import annotations

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

from .configs import load_risk_settings, require_database_url
from .constants import SCHEMA
from .controllers import RiskController
from .interfaces import AuditRecorder
from .loaders import load_container, load_services
from .procedures import create_risk_rpc_router, create_risk_rpc_server
from .repositories import IdentityAuditRecorder, PostgresRiskRepository
from .routes import create_admin_router, create_internal_router

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
    clock: Callable[[], datetime] | None = None,
) -> FastAPI:
    """Build the application; ``audit`` and ``clock`` are seams for tests."""
    resolved = settings or load_risk_settings()
    logger = logging.getLogger(resolved.service_name)

    pool = create_pool(require_database_url(resolved))
    repository = PostgresRiskRepository(pool, logger)
    recorder = audit or IdentityAuditRecorder(
        RpcClient(
            resolved.identity_service_url, "identity", resolved.service_timeout_ms
        ),
        logger,
    )

    container = load_container(repository, recorder, logger)
    command_bus, query_bus = load_services(container, clock)
    controller = RiskController(command_bus, query_bus)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        await pool.open()
        try:
            await apply_migrations(pool, SCHEMA, MIGRATIONS_DIRECTORY, logger)
            yield
        finally:
            await pool.close()

    return create_service_app(
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
