from __future__ import annotations

import asyncio
from collections import OrderedDict
from typing import Final

from betng_service_kit import QueryHandler

from .....constants import SimulationQuery
from .....dtos import ProbabilityMatrixResponse, TeamStrengthDto
from .....engine import ModelConfiguration, ProbabilityMatrix, price_match
from .....repositories import SimulationRepository
from .calculate_probabilities_query import CalculateProbabilitiesQuery

CACHE_SIZE: Final = 512

_Strength = tuple[float, ...]
_CacheKey = tuple[str | None, str, int, _Strength, _Strength]


def _strength_key(strength: TeamStrengthDto) -> _Strength:
    return tuple(strength.model_dump().values())


class CalculateProbabilitiesHandler(
    QueryHandler[CalculateProbabilitiesQuery, ProbabilityMatrixResponse]
):
    """Prices a match under the active model, cached per match and version."""

    message_type = SimulationQuery.CALCULATE_PROBABILITIES

    def __init__(self, repository: SimulationRepository) -> None:
        self._repository = repository
        self._cache: OrderedDict[_CacheKey, ProbabilityMatrix] = OrderedDict()
        self._lock = asyncio.Lock()

    async def execute(
        self, message: CalculateProbabilitiesQuery
    ) -> ProbabilityMatrixResponse:
        request = message.request

        async with self._repository.transaction() as connection:
            stored = await self._repository.get_active_configuration(connection)

        configuration = stored.configuration
        match_id = None if request.match_id is None else str(request.match_id)
        key: _CacheKey = (
            match_id,
            configuration.model_version,
            configuration.version,
            _strength_key(request.home),
            _strength_key(request.away),
        )

        async with self._lock:
            matrix = self._cache.get(key)
            if matrix is None:
                matrix = await asyncio.to_thread(
                    self._price, match_id, request.home, request.away, configuration
                )
                self._remember(key, matrix)
            else:
                self._cache.move_to_end(key)

        return ProbabilityMatrixResponse(
            home_xg=matrix.home_xg,
            away_xg=matrix.away_xg,
            max_goals=matrix.max_goals,
            score_matrix=[list(row) for row in matrix.cells],
            model_version=configuration.model_version,
            configuration_version=configuration.version,
        )

    @staticmethod
    def _price(
        match_id: str | None,
        home: TeamStrengthDto,
        away: TeamStrengthDto,
        configuration: ModelConfiguration,
    ) -> ProbabilityMatrix:
        return price_match(match_id, home.to_engine(), away.to_engine(), configuration)

    def _remember(self, key: _CacheKey, matrix: ProbabilityMatrix) -> None:
        self._cache[key] = matrix
        while len(self._cache) > CACHE_SIZE:
            self._cache.popitem(last=False)
