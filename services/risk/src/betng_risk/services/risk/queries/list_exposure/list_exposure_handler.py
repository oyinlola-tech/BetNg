from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import RiskQuery
from .....dtos import MatchExposureList
from .....interfaces import RiskRepository
from ...exposure_reader import ExposureReader
from .list_exposure_query import ListExposureQuery


class ListExposureHandler(QueryHandler[ListExposureQuery, MatchExposureList]):
    message_type = RiskQuery.LIST_EXPOSURE

    def __init__(self, repository: RiskRepository, reader: ExposureReader) -> None:
        self._repository = repository
        self._reader = reader

    async def execute(self, message: ListExposureQuery) -> MatchExposureList:
        match_ids = await self._repository.load_dashboard_match_ids()
        if not match_ids:
            return MatchExposureList(items=[])

        matches = await self._repository.load_matches(match_ids)
        limits = (await self._repository.load_limits()).limits

        return MatchExposureList(items=await self._reader.current(matches, limits))
