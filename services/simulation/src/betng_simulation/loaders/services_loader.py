"""Builds the CQRS buses and registers the application services on them."""

from __future__ import annotations

from betng_service_kit import CommandBus, Container, QueryBus

from ..constants import LOGGER_TOKEN
from ..services import register_simulation_service


def load_services(container: Container) -> tuple[CommandBus, QueryBus]:
    """Build the buses with every handler registered.

    Args:
        container: The container the handlers' dependencies come from.

    Returns:
        The command bus and the query bus.
    """
    command_bus = CommandBus()
    query_bus = QueryBus()

    register_simulation_service(container, command_bus, query_bus)

    container.resolve(LOGGER_TOKEN).debug(
        "CQRS handlers registered",
        extra={"commands": command_bus.size(), "queries": query_bus.size()},
    )

    return command_bus, query_bus
