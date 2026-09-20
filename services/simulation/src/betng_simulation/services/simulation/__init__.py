from __future__ import annotations

from betng_service_kit import CommandBus, Container, QueryBus

from ...constants import SIMULATION_ENGINE_TOKEN
from .commands import RunSimulationHandler
from .queries import GetProbabilitiesHandler


def register_simulation_service(
    container: Container, command_bus: CommandBus, query_bus: QueryBus
) -> None:
    engine = container.resolve(SIMULATION_ENGINE_TOKEN)

    command_bus.register(RunSimulationHandler(engine))
    query_bus.register(GetProbabilitiesHandler(engine))
