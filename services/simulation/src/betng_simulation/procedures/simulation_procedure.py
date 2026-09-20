"""The simulation service's RPC procedures.

Simulation is RPC-primary: its callers are the match service asking for an
authoritative result and the odds service asking for probabilities. Neither is
browsing a resource, so a procedure name and a typed payload fit better than a
URL — and a typed error that survives the wire beats interpreting a status
code.

The procedures dispatch onto the *same* command and query buses the REST
controller uses. There is exactly one implementation of each operation; REST
and RPC are two doors into it, not two copies of it. REST remains available
for debugging and manual inspection, as `docs/api/rpc.md` records.
"""

from __future__ import annotations

from betng_service_kit import CommandBus, QueryBus, RpcProcedure, RpcServer

from ..dtos import (
    OutcomeProbabilities,
    ProbabilityRequest,
    SimulationRequest,
    SimulationResult,
)
from ..services.simulation.commands import RunSimulationCommand
from ..services.simulation.queries import GetProbabilitiesQuery


class SimulationProcedure:
    """Procedure names this service answers."""

    GENERATE_MATCH = "simulation.generateMatch"
    CALCULATE_PROBABILITIES = "simulation.calculateProbabilities"


def create_simulation_rpc_server(
    command_bus: CommandBus, query_bus: QueryBus
) -> RpcServer:
    """Build the RPC server holding the simulation procedures.

    Args:
        command_bus: The bus the write handlers are registered on.
        query_bus: The bus the read handlers are registered on.

    Returns:
        The server to mount at ``POST /rpc``.
    """
    server = RpcServer()

    async def generate_match(payload: SimulationRequest) -> SimulationResult:
        return await command_bus.execute(RunSimulationCommand(payload))

    async def calculate_probabilities(
        payload: ProbabilityRequest,
    ) -> OutcomeProbabilities:
        return await query_bus.execute(GetProbabilitiesQuery(payload))

    server.register(
        RpcProcedure(
            name=SimulationProcedure.GENERATE_MATCH,
            handler=generate_match,
            payload_model=SimulationRequest,
        )
    )
    server.register(
        RpcProcedure(
            name=SimulationProcedure.CALCULATE_PROBABILITIES,
            handler=calculate_probabilities,
            payload_model=ProbabilityRequest,
        )
    )

    return server
