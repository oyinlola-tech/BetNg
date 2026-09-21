from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import AnalyticsQueryType
from .....dtos import PlatformOverview
from .....interfaces import AnalyticsReader
from .....utils import now, operator_result, to_iso
from .get_platform_overview_query import GetPlatformOverviewQuery


class GetPlatformOverviewHandler(
    QueryHandler[GetPlatformOverviewQuery, PlatformOverview]
):
    message_type = AnalyticsQueryType.GET_PLATFORM_OVERVIEW

    def __init__(self, reader: AnalyticsReader) -> None:
        self._reader = reader

    async def execute(self, message: GetPlatformOverviewQuery) -> PlatformOverview:
        row = await self._reader.platform_overview()

        return PlatformOverview(
            active_users=row["active_users"],
            active_shops=row["active_shops"],
            open_bets=row["open_bets"],
            live_matches=row["live_matches"],
            today_stake=row["stake"],
            today_payouts=row["payout"],
            today_net=operator_result(row["settled_stake"], row["payout"]),
            generated_at=to_iso(now()),
        )
