from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import SimulationQuery
from .....dtos import SquadsResponse
from .....engine import name_pool_for
from .....repositories import SimulationRepository
from .....utils import to_team_squad
from .get_squads_query import GetSquadsQuery


class GetSquadsHandler(QueryHandler[GetSquadsQuery, SquadsResponse]):
    message_type = SimulationQuery.GET_SQUADS

    def __init__(self, repository: SimulationRepository) -> None:
        self._repository = repository

    async def execute(self, message: GetSquadsQuery) -> SquadsResponse:
        request = message.request
        model_version: str | None = request.model_version

        if model_version is None:
            async with self._repository.transaction() as connection:
                stored = await self._repository.get_active_configuration(connection)
            model_version = stored.configuration.model_version

        name_pool = name_pool_for(model_version)

        return SquadsResponse(
            home=to_team_squad(request.home.team_id, name_pool, request.home.country),
            away=to_team_squad(request.away.team_id, name_pool, request.away.country),
        )
