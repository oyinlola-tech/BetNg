from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from betng_service_kit import (
    ServiceSettings,
    create_pool,
    create_service_app,
    database_probe,
)
from fastapi import FastAPI

from .configs import load_analytics_settings, load_report_timezone, read_only_conninfo
from .controllers import AnalyticsController
from .loaders import load_container, load_services
from .repositories import create_analytics_reader
from .routes import create_admin_router, create_internal_router, create_shop_router

DESCRIPTION = (
    "Read-only global bet analysis and reports. Every figure is a SQL "
    "aggregate over the complete accepted-bet population, traceable to "
    "database rows. It owns no schema, writes nothing, and never answers a "
    "result for a match that is not completed."
)


def create_app(settings: ServiceSettings | None = None) -> FastAPI:
    resolved = settings or load_analytics_settings()

    if resolved.database_url is None:
        raise ValueError("ANALYTICS_DATABASE_URL is required.")

    report_timezone = load_report_timezone()
    logger = logging.getLogger(resolved.service_name)
    pool = create_pool(read_only_conninfo(resolved.database_url))

    reader = create_analytics_reader(pool, report_timezone, logger)
    container = load_container(reader, logger)
    query_bus = load_services(container)
    controller = AnalyticsController(query_bus, report_timezone)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        # No wait: a database that is down shows on `/ready` and as
        # DATABASE_UNAVAILABLE instead of stopping the process.
        await pool.open(wait=False)

        try:
            yield
        finally:
            await pool.close()

    return create_service_app(
        resolved,
        description=DESCRIPTION,
        routers=[
            create_internal_router(controller),
            create_admin_router(controller),
            create_shop_router(controller),
        ],
        probes=[database_probe(pool)],
        lifespan=lifespan,
    )
