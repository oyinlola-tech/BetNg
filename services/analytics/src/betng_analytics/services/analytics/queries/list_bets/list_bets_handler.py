from __future__ import annotations

from collections import defaultdict

from betng_service_kit import QueryHandler

from .....constants import AnalyticsQueryType
from .....dtos import BetPage
from .....interfaces import AnalyticsReader
from .....types import Row
from ...mappers import to_bet_record
from .list_bets_query import ListBetsQuery


class ListBetsHandler(QueryHandler[ListBetsQuery, BetPage]):
    message_type = AnalyticsQueryType.LIST_BETS

    def __init__(self, reader: AnalyticsReader) -> None:
        self._reader = reader

    async def execute(self, message: ListBetsQuery) -> BetPage:
        rows = await self._reader.bets(
            message.scope, message.page, message.page_size
        )

        legs: defaultdict[str, list[Row]] = defaultdict(list)

        for leg in rows.legs:
            legs[str(leg["bet_id"])].append(leg)

        return BetPage(
            items=[to_bet_record(bet, legs[str(bet["id"])]) for bet in rows.bets],
            page=message.page,
            page_size=message.page_size,
            total=rows.total,
        )
