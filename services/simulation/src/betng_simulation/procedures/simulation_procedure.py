"""The simulation service's RPC procedures.

Simulation is RPC-primary: its callers are the match service asking for an
authoritative result and the odds service asking for the score matrix. Neither
is browsing a resource, so a procedure name and a typed payload fit better
than a URL, and a typed error that survives the wire beats interpreting a
status code.

The procedures dispatch onto the *same* command and query buses the REST
controllers use. There is exactly one implementation of each operation; REST
and RPC are two doors into it, not two copies of it.
"""

from __future__ import annotations

from typing import Any

from betng_service_kit import CommandBus, QueryBus, RpcProcedure, RpcServer

from ..dtos import CalculateProbabilitiesRequest, RunMatchRequest
from ..services.simulation.commands import RunMatchCommand
from ..services.simulation.queries import CalculateProbabilitiesQuery


class SimulationProcedure:
    """RPC procedure names (architecture §6)."""

    RUN_MATCH = "simulation.runMatch"
    CALCULATE_PROBABILITIES = "simulation.calculateProbabilities"


def create_simulation_rpc_server(
    command_bus: CommandBus, query_bus: QueryBus
) -> RpcServer:
    """Register the RPC procedures on the shared buses."""
    server = RpcServer()

    # The handlers return plain camelCase JSON: the kit would otherwise dump a
    # model by field name, and the wire contract is by alias.
    async def run_match(payload: RunMatchRequest) -> dict[str, Any]:
        response = await command_bus.execute(RunMatchCommand(payload))

        return response.model_dump(by_alias=True, mode="json")

    async def calculate_probabilities(
        payload: CalculateProbabilitiesRequest,
    ) -> dict[str, Any]:
        response = await query_bus.execute(CalculateProbabilitiesQuery(payload))

        return response.model_dump(by_alias=True, mode="json")

    server.register(
        RpcProcedure(
            name=SimulationProcedure.RUN_MATCH,
            handler=run_match,
            payload_model=RunMatchRequest,
        )
    )
    server.register(
        RpcProcedure(
            name=SimulationProcedure.CALCULATE_PROBABILITIES,
            handler=calculate_probabilities,
            payload_model=CalculateProbabilitiesRequest,
        )
    )

    return server
