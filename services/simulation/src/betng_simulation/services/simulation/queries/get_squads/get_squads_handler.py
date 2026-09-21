from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import SimulationQuery
from .....dtos import SquadsResponse
from .....utils import to_team_squad
from .get_squads_query import GetSquadsQuery


class GetSquadsHandler(QueryHandler[GetSquadsQuery, SquadsResponse]):
    message_type = SimulationQuery.GET_SQUADS

    async def execute(self, message: GetSquadsQuery) -> SquadsResponse:
        return SquadsResponse(
            home=to_team_squad(message.request.home.team_id),
            away=to_team_squad(message.request.away.team_id),
        )
