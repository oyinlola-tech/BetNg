from __future__ import annotations

import asyncio
from uuid import UUID

from betng_service_kit import CommandBus, QueryBus

from ..dtos import (
    BatchRunMatchBody,
    BatchRunMatchRequest,
    BatchRunMatchResponse,
    MatchEventList,
    MatchRunDetail,
    ReplayMatchResponse,
    RunMatchBody,
    RunMatchRequest,
    RunMatchResponse,
)
from ..services.simulation.commands import RunMatchCommand
from ..services.simulation.queries import (
    GetMatchRunQuery,
    ListMatchEventsQuery,
    ReplayMatchQuery,
)


class SimulationController:
    def __init__(self, command_bus: CommandBus, query_bus: QueryBus) -> None:
        self._command_bus = command_bus
        self._query_bus = query_bus

    async def run_match(self, match_id: UUID, body: RunMatchBody) -> RunMatchResponse:
        request = RunMatchRequest(match_id=match_id, home=body.home, away=body.away)

        return await self._command_bus.execute(RunMatchCommand(request))

    async def batch_run_matches(self, body: BatchRunMatchBody) -> BatchRunMatchResponse:
        """Run multiple matches concurrently."""
        tasks = [
            self._run_single_match(item.match_id, item.home, item.away)
            for item in body.matches
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        responses = []
        for result in results:
            if isinstance(result, Exception):
                responses.append({"error": str(result)[:200]})
            else:
                responses.append(result)

        return BatchRunMatchResponse(results=responses)

    async def _run_single_match(
        self, match_id: UUID, home: dict, away: dict
    ) -> RunMatchResponse:
        request = RunMatchRequest(match_id=match_id, home=home, away=away)
        return await self._command_bus.execute(RunMatchCommand(request))

    async def get_match_run(self, match_id: UUID) -> MatchRunDetail:
        return await self._query_bus.execute(GetMatchRunQuery(str(match_id)))

    async def list_match_events(self, match_id: UUID) -> MatchEventList:
        return await self._query_bus.execute(ListMatchEventsQuery(str(match_id)))

    async def replay_match(self, match_id: UUID) -> ReplayMatchResponse:
        return await self._query_bus.execute(ReplayMatchQuery(str(match_id)))
