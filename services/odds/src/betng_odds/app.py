from __future__ import annotations

import logging

from betng_service_kit import ServiceSettings, create_service_app
from fastapi import FastAPI

from .configs import load_odds_settings
from .controllers import OddsController
from .loaders import load_container, load_services
from .procedures import create_odds_rpc_server
from .repositories import create_odds_pricer
from .routes import create_odds_router

DESCRIPTION = (
    "Turns the simulation service's outcome probabilities into markets and "
    "prices. Owns price, never probability: a change to the book's margin "
    "cannot become a change to how likely an outcome is."
)


def create_app(settings: ServiceSettings | None = None) -> FastAPI:
    resolved = settings or load_odds_settings()

    pricer = create_odds_pricer()
    logger = logging.getLogger(resolved.service_name)
    container = load_container(pricer, logger)
    command_bus, query_bus = load_services(container)

    controller = OddsController(command_bus, query_bus)

    return create_service_app(
        resolved,
        description=DESCRIPTION,
        routers=[create_odds_router(controller)],
        # RPC is this service's primary API: its caller is the betting
        # service on the bet-placement path. REST stays for debugging.
        rpc_server=create_odds_rpc_server(command_bus, query_bus),
        # The odds service reaches nothing of its own in this phase: it is
        # handed probabilities rather than fetching them. An empty list is
        # the honest answer.
        probes=[],
    )
