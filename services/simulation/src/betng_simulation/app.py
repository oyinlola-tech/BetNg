"""Assembles the simulation service.

The pieces are wired in dependency order: the engine, the container that holds
it, the CQRS buses the application service registers on, the controller, and
the FastAPI application.

``betng_service_kit`` supplies everything that must not differ between BetNG
services — logging, correlation, the error envelope and the health endpoints —
so this file contains only what is specific to the simulation service.
"""

from __future__ import annotations

import logging

from betng_service_kit import ServiceSettings, create_service_app
from fastapi import FastAPI

from .configs import load_simulation_settings
from .controllers import SimulationController
from .loaders import load_container, load_services
from .procedures import create_simulation_rpc_server
from .repositories import create_simulation_engine
from .routes import create_simulation_router

DESCRIPTION = (
    "Produces virtual match results and the outcome probabilities the odds "
    "service prices from. Runs only after betting has closed, and receives no "
    "bet data, so a result cannot be influenced by the book's position."
)


def create_app(settings: ServiceSettings | None = None) -> FastAPI:
    """Build the simulation service.

    Args:
        settings: The configuration. Read from the environment when omitted;
            the tests pass their own.

    Returns:
        The configured application.
    """
    resolved = settings or load_simulation_settings()

    engine = create_simulation_engine()
    logger = logging.getLogger(resolved.service_name)
    container = load_container(engine, logger)
    command_bus, query_bus = load_services(container)

    controller = SimulationController(command_bus, query_bus)

    return create_service_app(
        resolved,
        description=DESCRIPTION,
        routers=[create_simulation_router(controller)],
        # RPC is this service's primary API: its callers are the match and
        # odds services, not a browser. REST stays available for debugging.
        rpc_server=create_simulation_rpc_server(command_bus, query_bus),
        # The simulation service reaches nothing: no database, no cache and
        # no peer service. An empty list is the honest answer, rather than a
        # probe invented so the endpoint looks busy.
        probes=[],
    )
