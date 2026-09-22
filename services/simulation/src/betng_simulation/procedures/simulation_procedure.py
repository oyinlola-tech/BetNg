from __future__ import annotations

from typing import Any

from betng_service_kit import CommandBus, QueryBus, RpcProcedure, RpcServer

from ..dtos import (
    CalculateProbabilitiesRequest,
    GetSquadsRequest,
    ReplayMatchRequest,
    RunMatchRequest,
)
from ..services.simulation.commands import RunMatchCommand
from ..services.simulation.queries import (
    CalculateProbabilitiesQuery,
    GetSquadsQuery,
    ReplayMatchQuery,
)


class SimulationProcedure:
    RUN_MATCH = "simulation.runMatch"
    CALCULATE_PROBABILITIES = "simulation.calculateProbabilities"
    GET_SQUADS = "simulation.getSquads"
    REPLAY_MATCH = "simulation.replayMatch"


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

    async def get_squads(payload: GetSquadsRequest) -> dict[str, Any]:
        response = await query_bus.execute(GetSquadsQuery(payload))

        return response.model_dump(by_alias=True, mode="json")

    async def replay_match(payload: ReplayMatchRequest) -> dict[str, Any]:
        response = await query_bus.execute(ReplayMatchQuery(str(payload.match_id)))

        return response.model_dump(by_alias=True, mode="json")

    server.register(
        RpcProcedure(
            name=SimulationProcedure.REPLAY_MATCH,
            handler=replay_match,
            payload_model=ReplayMatchRequest,
        )
    )
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

    server.register(
        RpcProcedure(
            name=SimulationProcedure.GET_SQUADS,
            handler=get_squads,
            payload_model=GetSquadsRequest,
        )
    )

    return server
