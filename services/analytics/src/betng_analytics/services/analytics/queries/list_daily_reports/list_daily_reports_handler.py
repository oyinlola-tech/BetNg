from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import AnalyticsQueryType
from .....dtos import PlatformReportDay, PlatformReportDayList
from .....interfaces import AnalyticsReader
from .....utils import operator_result
from .list_daily_reports_query import ListDailyReportsQuery


class ListDailyReportsHandler(
    QueryHandler[ListDailyReportsQuery, PlatformReportDayList]
):
    message_type = AnalyticsQueryType.LIST_DAILY_REPORTS

    def __init__(self, reader: AnalyticsReader) -> None:
        self._reader = reader

    async def execute(self, message: ListDailyReportsQuery) -> PlatformReportDayList:
        rows = await self._reader.daily_reports(message.days)

        return PlatformReportDayList(
            items=[
                PlatformReportDay(
                    date=row["day"].isoformat(),
                    stake=row["stake"],
                    payouts=row["payout"],
                    net=operator_result(row["settled_stake"], row["payout"]),
                    bets=row["bets"],
                    online_stake=row["online_stake"],
                    shop_stake=row["shop_stake"],
                )
                for row in rows
            ]
        )
