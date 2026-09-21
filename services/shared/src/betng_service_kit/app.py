from __future__ import annotations

from collections.abc import Callable
from contextlib import AbstractAsyncContextManager

from fastapi import APIRouter, FastAPI

from .config import ServiceSettings
from .errors import install_error_handlers
from .internal_auth import assert_internal_token_configured
from .health import DependencyProbe, create_health_router
from .logging import configure_logging
from .middleware import AccessLogMiddleware, RequestIdMiddleware
from .rpc import RpcServer, create_rpc_router


def create_service_app(
    settings: ServiceSettings,
    *,
    description: str,
    routers: list[APIRouter] | None = None,
    probes: list[DependencyProbe] | None = None,
    rpc_server: RpcServer | None = None,
    lifespan: Callable[[FastAPI], AbstractAsyncContextManager[None]] | None = None,
) -> FastAPI:
    assert_internal_token_configured()

    configure_logging(
        settings.service_name,
        settings.version,
        settings.environment,
        settings.log_level,
    )

    app = FastAPI(
        title=f"betng-{settings.service_name}",
        description=description,
        version=settings.version,
        # The docs are development aids, not a public surface.
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url=None,
        # Where a service opens its pool, applies migrations and starts jobs.
        lifespan=lifespan,
    )

    # Registration order is reversed at request time, so the correlation
    # middleware added last runs first — and the access log it wraps can
    # already read the identifier.
    app.add_middleware(AccessLogMiddleware, logger_name=settings.service_name)
    app.add_middleware(RequestIdMiddleware)

    install_error_handlers(app)

    app.include_router(create_health_router(settings, probes or []))

    if rpc_server is not None:
        app.include_router(create_rpc_router(rpc_server))

    for router in routers or []:
        app.include_router(router)

    return app
