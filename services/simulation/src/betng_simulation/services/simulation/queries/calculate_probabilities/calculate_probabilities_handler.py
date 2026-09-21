"""Calculate probabilities handler."""

from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import SimulationQuery
from .....dtos import ProbabilityMatrixResponse
from .....engine import calculate_probabilities
from .....repositories import SimulationRepository
from .calculate_probabilities_query import CalculateProbabilitiesQuery


class CalculateProbabilitiesHandler(
    QueryHandler[CalculateProbabilitiesQuery, ProbabilityMatrixResponse]
):
    """Builds the score matrix under the active configuration.

    The simulation service owns probability; the odds service turns it into a
    price. This is the same function the engine samples a result from, so a
    price and the outcome it prices share one distribution.
    """

    message_type = SimulationQuery.CALCULATE_PROBABILITIES

    def __init__(self, repository: SimulationRepository) -> None:
        """Store the collaborators."""
        self._repository = repository

    async def execute(
        self, message: CalculateProbabilitiesQuery
    ) -> ProbabilityMatrixResponse:
        """Execute the message."""
        async with self._repository.transaction() as connection:
            stored = await self._repository.get_active_configuration(connection)

        configuration = stored.configuration
        matrix = calculate_probabilities(
            message.request.home.to_engine(),
            message.request.away.to_engine(),
            configuration,
        )

        return ProbabilityMatrixResponse(
            home_xg=matrix.home_xg,
            away_xg=matrix.away_xg,
            max_goals=matrix.max_goals,
            score_matrix=[list(row) for row in matrix.cells],
            model_version=configuration.model_version,
            configuration_version=configuration.version,
        )
