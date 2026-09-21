from __future__ import annotations

from uuid import UUID

from betng_service_kit import CommandBus, QueryBus

from ..dtos import (
    MatchEventList,
    MatchRunDetail,
    RunMatchBody,
    RunMatchRequest,
    RunMatchResponse,
)
from ..services.simulation.commands import RunMatchCommand
from ..services.simulation.queries import GetMatchRunQuery, ListMatchEventsQuery


class SimulationController:
    def __init__(self, command_bus: CommandBus, query_bus: QueryBus) -> None:
        self._command_bus = command_bus
        self._query_bus = query_bus

    async def run_match(self, match_id: UUID, body: RunMatchBody) -> RunMatchResponse:
        request = RunMatchRequest(match_id=match_id, home=body.home, away=body.away)

        return await self._command_bus.execute(RunMatchCommand(request))

    async def get_match_run(self, match_id: UUID) -> MatchRunDetail:
        return await self._query_bus.execute(GetMatchRunQuery(str(match_id)))

    async def list_match_events(self, match_id: UUID) -> MatchEventList:
        return await self._query_bus.execute(ListMatchEventsQuery(str(match_id)))
