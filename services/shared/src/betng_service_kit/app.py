"""The FastAPI bootstrap shared by every BetNG Python service.

A service supplies its settings, its routers and its dependency probes; this
assembles the rest: structured logging, request correlation, access logging,
the error envelope and the health endpoints.

It plays the same role ``@betng/service-kit`` plays on the TypeScript side, so
the two halves of the platform behave identically at their edges — same log
shape, same correlation header, same error body, same health semantics — while
each stays idiomatic in its own language.
"""

from __future__ import annotations

from fastapi import APIRouter, FastAPI

from .config import ServiceSettings
from .errors import install_error_handlers
from .health import DependencyProbe, create_health_router
from .logging import configure_logging
from .middleware import AccessLogMiddleware, RequestIdMiddleware


def create_service_app(
    settings: ServiceSettings,
    *,
    description: str,
    routers: list[APIRouter] | None = None,
    probes: list[DependencyProbe] | None = None,
) -> FastAPI:
    """Build a BetNG Python service.

    Args:
        settings: The configuration read from the environment.
        description: What the service does, shown in the OpenAPI document.
        routers: The service's domain routers.
        probes: The dependencies ``/ready`` probes.

    Returns:
        The configured application.
    """
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
    )

    # Registration order is reversed at request time, so the correlation
    # middleware added last runs first — and the access log it wraps can
    # already read the identifier.
    app.add_middleware(AccessLogMiddleware, logger_name=settings.service_name)
    app.add_middleware(RequestIdMiddleware)

    install_error_handlers(app)

    app.include_router(create_health_router(settings, probes or []))

    for router in routers or []:
        app.include_router(router)

    return app
