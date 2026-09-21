"""Application assembly."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass

from betng_service_kit import (
    DependencyProbe,
    Pool,
    RpcClient,
    ServiceSettings,
    apply_migrations,
    create_pool,
    create_service_app,
    database_probe,
)
from fastapi import FastAPI

from .configs import (
    DATABASE_SCHEMA,
    MIGRATIONS_DIRECTORY,
    load_odds_settings,
    require_database_url,
)
from .controllers import OddsController
from .interfaces import (
    AuditRecorder,
    EventPublisher,
    ExposureReader,
    MatchDirectory,
    ProbabilityModel,
)
from .loaders import OddsDependencies, load_container, load_services
from .middlewares import RequestContextMiddleware
from .procedures import create_odds_rpc_server
from .repositories import (
    PostgresExposureReader,
    PostgresMatchDirectory,
    PostgresOddsRepository,
    RpcAuditRecorder,
    RpcEventPublisher,
    RpcProbabilityModel,
)
from .routes import create_odds_router

DESCRIPTION = (
    "Turns the simulation service's score probabilities into markets and "
    "prices, and stores them as versioned, immutable snapshots. Owns price, "
    "never probability, and prices markets, never users: every reader gets the "
    "same rows."
)


@dataclass(frozen=True)
class PeerOverrides:
    """Replacements for the collaborators that live outside the odds schema."""

    probability_model: ProbabilityModel | None = None
    event_publisher: EventPublisher | None = None
    audit_recorder: AuditRecorder | None = None
    match_directory: MatchDirectory | None = None
    exposure_reader: ExposureReader | None = None


def _dependencies(
    settings: ServiceSettings,
    pool: Pool,
    logger: logging.Logger,
    overrides: PeerOverrides,
) -> OddsDependencies:
    timeout_ms = settings.service_timeout_ms

    return OddsDependencies(
        repository=PostgresOddsRepository(pool),
        probability_model=overrides.probability_model
        or RpcProbabilityModel(
            client=RpcClient(settings.simulation_service_url, "simulation", timeout_ms),
            health_url=settings.simulation_service_url.rstrip("/") + "/health",
            timeout_seconds=timeout_ms / 1000,
            logger=logger,
        ),
        event_publisher=overrides.event_publisher
        or RpcEventPublisher(
            RpcClient(settings.event_service_url, "event", timeout_ms)
        ),
        audit_recorder=overrides.audit_recorder
        or RpcAuditRecorder(
            RpcClient(settings.identity_service_url, "identity", timeout_ms), logger
        ),
        match_directory=overrides.match_directory or PostgresMatchDirectory(pool),
        exposure_reader=overrides.exposure_reader or PostgresExposureReader(pool),
    )


def create_app(
    settings: ServiceSettings | None = None,
    *,
    overrides: PeerOverrides | None = None,
) -> FastAPI:
    """Build the service. ``overrides`` lets a test stand in for a peer."""
    resolved = settings or load_odds_settings()
    logger = logging.getLogger(resolved.service_name)
    pool = create_pool(require_database_url(resolved))

    dependencies = _dependencies(resolved, pool, logger, overrides or PeerOverrides())
    container = load_container(dependencies, logger)
    command_bus, query_bus = load_services(container)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        await pool.open()

        try:
            await apply_migrations(pool, DATABASE_SCHEMA, MIGRATIONS_DIRECTORY, logger)
            yield
        finally:
            await pool.close()

    app = create_service_app(
        resolved,
        description=DESCRIPTION,
        routers=[create_odds_router(OddsController(command_bus, query_bus))],
        rpc_server=create_odds_rpc_server(command_bus),
        probes=[
            database_probe(pool),
            DependencyProbe(
                name="simulation", check=dependencies.probability_model.ping
            ),
        ],
        lifespan=lifespan,
    )
    app.add_middleware(RequestContextMiddleware)

    return app
