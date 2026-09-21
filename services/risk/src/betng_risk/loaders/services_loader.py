from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from betng_service_kit import CommandBus, Container, QueryBus

from ..constants import LOGGER_TOKEN
from ..services import register_risk_service


def load_services(
    container: Container, clock: Callable[[], datetime] | None = None
) -> tuple[CommandBus, QueryBus]:
    command_bus = CommandBus()
    query_bus = QueryBus()

    if clock is None:
        register_risk_service(container, command_bus, query_bus)
    else:
        register_risk_service(container, command_bus, query_bus, clock)

    container.resolve(LOGGER_TOKEN).debug(
        "Handlers registered",
        extra={"commands": command_bus.size(), "queries": query_bus.size()},
    )

    return command_bus, query_bus
