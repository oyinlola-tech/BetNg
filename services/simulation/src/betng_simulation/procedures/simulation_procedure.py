from __future__ import annotations

from typing import Any

from betng_service_kit import CommandBus, QueryBus, RpcProcedure, RpcServer

from ..dtos import CalculateProbabilitiesRequest, RunMatchRequest
from ..services.simulation.commands import RunMatchCommand
from ..services.simulation.queries import CalculateProbabilitiesQuery


class SimulationProcedure:
    RUN_MATCH = "simulation.runMatch"
    CALCULATE_PROBABILITIES = "simulation.calculateProbabilities"


def create_simulation_rpc_server(
    command_bus: CommandBus, query_bus: QueryBus
) -> RpcServer:
    server = RpcServer()

    # Dumped by alias here: the kit would dump a model by field name.
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
