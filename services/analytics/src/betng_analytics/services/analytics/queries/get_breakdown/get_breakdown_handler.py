from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import AnalyticsQueryType
from .....dtos import AnalyticsBreakdown
from .....interfaces import AnalyticsReader
from .....utils import to_iso_or_none
from ...mappers import to_breakdown_row
from .get_breakdown_query import GetBreakdownQuery


class GetBreakdownHandler(QueryHandler[GetBreakdownQuery, AnalyticsBreakdown]):
    message_type = AnalyticsQueryType.GET_BREAKDOWN

    def __init__(self, reader: AnalyticsReader) -> None:
        self._reader = reader

    async def execute(self, message: GetBreakdownQuery) -> AnalyticsBreakdown:
        rows = await self._reader.breakdown(
            message.dimension, message.scope, message.limit
        )

        return AnalyticsBreakdown(
            by=message.dimension,
            from_=to_iso_or_none(message.scope.window.start),
            to=to_iso_or_none(message.scope.window.end),
            items=[to_breakdown_row(row) for row in rows],
        )
