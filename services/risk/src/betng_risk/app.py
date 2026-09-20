"""Assembles the risk service.

``betng_service_kit`` supplies everything that must not differ between BetNG
services — logging, correlation, the error envelope and the health endpoints —
so this file contains only what is specific to the risk service.
"""

from __future__ import annotations

import logging

from betng_service_kit import ServiceSettings, create_service_app
from fastapi import FastAPI

from .configs import load_risk_settings
from .controllers import RiskController
from .loaders import load_container, load_services
from .procedures import create_risk_rpc_server
from .repositories import create_risk_analyser
from .routes import create_risk_router

DESCRIPTION = (
    "Assesses the exposure a market carries while it is still open, so the "
    "platform can reprice or suspend before betting closes. Internal: it is "
    "not reachable from a public client, and it can never alter a bet, a "
    "price or a match result."
)


def create_app(settings: ServiceSettings | None = None) -> FastAPI:
    """Build the risk service.

    Args:
        settings: The configuration. Read from the environment when omitted;
            the tests pass their own.

    Returns:
        The configured application.
    """
    resolved = settings or load_risk_settings()

    analyser = create_risk_analyser()
    logger = logging.getLogger(resolved.service_name)
    container = load_container(analyser, logger)
    query_bus = load_services(container)

    controller = RiskController(query_bus)

    return create_service_app(
        resolved,
        description=DESCRIPTION,
        routers=[create_risk_router(controller)],
        # RPC is this service's primary API: its caller is the betting
        # service, and it must not be reachable from a public client.
        rpc_server=create_risk_rpc_server(query_bus),
        # The risk service reaches nothing: it is handed stakes and returns
        # an analysis. An empty list is the honest answer.
        probes=[],
    )
