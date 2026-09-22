from __future__ import annotations

import asyncio
import contextlib
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

from .configs import (
    load_analytics_settings,
    load_report_timezone,
    load_summary_refresh_seconds,
    read_only_conninfo,
)
from .constants import DEFAULT_SUMMARY_REFRESH_SECONDS
from .controllers import AnalyticsController
from .jobs import run_daily_summary_job
from .loaders import load_container, load_services
from .repositories import DailySummary, PostgresExportReader, create_analytics_reader
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

    refresh_seconds = load_summary_refresh_seconds(DEFAULT_SUMMARY_REFRESH_SECONDS)
    summary = (
        DailySummary(pool, report_timezone, logger) if refresh_seconds > 0 else None
    )

    reader = create_analytics_reader(pool, report_timezone, logger, summary)
    exports = PostgresExportReader(pool, logger)
    container = load_container(reader, exports, report_timezone, logger)
    query_bus = load_services(container)
    controller = AnalyticsController(query_bus, report_timezone)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        # No wait: a database that is down shows on `/ready` and as
        # DATABASE_UNAVAILABLE instead of stopping the process.
        await pool.open(wait=False)
        job = (
            asyncio.create_task(
                run_daily_summary_job(summary, report_timezone, refresh_seconds, logger)
            )
            if summary is not None
            else None
        )

        try:
            yield
        finally:
            if job is not None:
                job.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await job
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
