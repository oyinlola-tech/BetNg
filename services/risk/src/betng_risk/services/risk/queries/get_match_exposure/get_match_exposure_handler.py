from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import RiskQuery
from .....dtos import MatchExposure
from .....errors import MatchNotFoundError
from .....interfaces import RiskRepository
from ...exposure_reader import ExposureReader
from .get_match_exposure_query import GetMatchExposureQuery


class GetMatchExposureHandler(QueryHandler[GetMatchExposureQuery, MatchExposure]):
    message_type = RiskQuery.GET_MATCH_EXPOSURE

    def __init__(self, repository: RiskRepository, reader: ExposureReader) -> None:
        self._repository = repository
        self._reader = reader

    async def execute(self, message: GetMatchExposureQuery) -> MatchExposure:
        """Return the match's exposure or refuse an unknown match."""
        matches = await self._repository.load_matches([message.match_id])
        if not matches:
            raise MatchNotFoundError

        limits = (await self._repository.load_limits()).limits

        return (await self._reader.current(matches, limits))[0]
