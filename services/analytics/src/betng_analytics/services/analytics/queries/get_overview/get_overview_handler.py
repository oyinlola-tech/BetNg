from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import AnalyticsQueryType
from .....dtos import AnalyticsOverview
from .....interfaces import AnalyticsReader
from .....utils import now
from ...mappers import to_overview
from .get_overview_query import GetOverviewQuery


class GetOverviewHandler(QueryHandler[GetOverviewQuery, AnalyticsOverview]):
    message_type = AnalyticsQueryType.GET_OVERVIEW

    def __init__(self, reader: AnalyticsReader) -> None:
        self._reader = reader

    async def execute(self, message: GetOverviewQuery) -> AnalyticsOverview:
        row = await self._reader.overview(message.scope)

        return to_overview(row, message.scope.window, now())
