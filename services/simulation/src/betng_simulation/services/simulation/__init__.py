"""The simulation application service.

Registers every simulation command and query handler on the buses, resolving
the engine from the container, so the composition of the domain is visible in
one place.
"""

from __future__ import annotations

from betng_service_kit import CommandBus, Container, QueryBus

from ...constants import SIMULATION_ENGINE_TOKEN
from .commands import RunSimulationHandler
from .queries import GetProbabilitiesHandler


def register_simulation_service(
    container: Container, command_bus: CommandBus, query_bus: QueryBus
) -> None:
    """Register the simulation handlers with their buses.

    Args:
        container: The container the handlers' dependencies come from.
        command_bus: The bus to register write handlers on.
        query_bus: The bus to register read handlers on.
    """
    engine = container.resolve(SIMULATION_ENGINE_TOKEN)

    command_bus.register(RunSimulationHandler(engine))
    query_bus.register(GetProbabilitiesHandler(engine))
