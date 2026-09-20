from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import SimulationQuery
from .....dtos import OutcomeProbabilities
from .....interfaces import SimulationEngine
from .get_probabilities_query import GetProbabilitiesQuery


class GetProbabilitiesHandler(
    QueryHandler[GetProbabilitiesQuery, OutcomeProbabilities]
):
    """Computes outcome probabilities through the engine.

    The simulation service owns probability; the odds service turns it into a
    price. Splitting them means a change to pricing margin cannot quietly
    become a change to how likely an outcome is.
    """

    message_type = SimulationQuery.GET_PROBABILITIES

    def __init__(self, engine: SimulationEngine) -> None:
        self._engine = engine

    async def execute(
        self, message: GetProbabilitiesQuery
    ) -> OutcomeProbabilities:
        return await self._engine.probabilities(
            message.request.homeTeam.strength,
            message.request.awayTeam.strength,
        )
