from __future__ import annotations

from betng_service_kit import Container, QueryBus

from ..constants import LOGGER_TOKEN
from ..services import register_risk_service


def load_services(container: Container) -> QueryBus:
    query_bus = QueryBus()

    register_risk_service(container, query_bus)

    container.resolve(LOGGER_TOKEN).debug(
        "Query handlers registered", extra={"queries": query_bus.size()}
    )

    return query_bus
