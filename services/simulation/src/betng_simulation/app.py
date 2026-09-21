from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from betng_service_kit import (
    RpcClient,
    ServiceSettings,
    apply_migrations,
    create_pool,
    create_rpc_router,
    create_service_app,
    database_probe,
)
from fastapi import APIRouter, Depends, FastAPI

from .configs import (
    DATABASE_SCHEMA,
    IDENTITY_PEER,
    MIGRATIONS_DIRECTORY,
    SEED_SECRET_VARIABLE,
    load_seed_secret,
    load_simulation_settings,
    require_database_url,
)
from .constants import BACKGROUND_AUDITOR_TOKEN
from .controllers import AdminSimulationController, SimulationController
from .engine import ModelConfiguration, simulate
from .interfaces import AuditRecorder, MatchReadModel, Simulate
from .loaders import load_container, load_services
from .middlewares import bind_request_context
from .procedures import create_simulation_rpc_server
from .repositories import (
    IdentityAuditRecorder,
    PostgresMatchReadModel,
    SimulationRepository,
)
from .routes import create_admin_router, create_internal_router

DESCRIPTION = (
    "Produces the one authoritative result and timeline of every virtual match, "
    "and the score matrix the odds service prices from. It receives teams and a "
    "match id, never bet data, so a result cannot be influenced by the book's "
    "position."
)


def create_app(
    settings: ServiceSettings | None = None,
    *,
    audit_recorder: AuditRecorder | None = None,
    match_read_model: MatchReadModel | None = None,
    simulate_match: Simulate = simulate,
) -> FastAPI:
    resolved = settings or load_simulation_settings()
    logger = logging.getLogger(resolved.service_name)
    seed_secret = load_seed_secret(resolved.environment)

    pool = create_pool(require_database_url(resolved))
    repository = SimulationRepository(pool)
    container = load_container(
        repository,
        match_read_model or PostgresMatchReadModel(pool),
        audit_recorder
        or IdentityAuditRecorder(
            RpcClient(
                resolved.identity_service_url,
                IDENTITY_PEER,
                resolved.service_timeout_ms,
            )
        ),
        simulate_match,
        seed_secret,
        logger,
    )
    command_bus, query_bus = load_services(container)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        await pool.open()
        if seed_secret is None:
            logger.warning(
                "Seeds are not keyed: results are derivable from public inputs",
                extra={"event": "seed_secret_missing", "variable": SEED_SECRET_VARIABLE},
            )
        try:
            await apply_migrations(pool, DATABASE_SCHEMA, MIGRATIONS_DIRECTORY, logger)
            await repository.ensure_default_configuration(ModelConfiguration())
            yield
            await container.resolve(BACKGROUND_AUDITOR_TOKEN).drain()
        finally:
            await pool.close()

    # Mounted here, not by the kit, so RPC calls also bind the request id.
    rpc_router = APIRouter(dependencies=[Depends(bind_request_context)])
    rpc_router.include_router(
        create_rpc_router(create_simulation_rpc_server(command_bus, query_bus))
    )

    return create_service_app(
        resolved,
        description=DESCRIPTION,
        routers=[
            rpc_router,
            create_internal_router(SimulationController(command_bus, query_bus)),
            create_admin_router(AdminSimulationController(command_bus, query_bus)),
        ],
        probes=[database_probe(pool)],
        lifespan=lifespan,
    )
