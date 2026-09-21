from __future__ import annotations

from collections import defaultdict
from datetime import date

from betng_service_kit import QueryHandler

from .....constants import AnalyticsQueryType
from .....dtos import (
    ShopCashierDay,
    ShopDailyReport,
    ShopDailyReportList,
    ShopLeagueDay,
)
from .....interfaces import AnalyticsReader
from .list_shop_daily_reports_query import ListShopDailyReportsQuery


class ListShopDailyReportsHandler(
    QueryHandler[ListShopDailyReportsQuery, ShopDailyReportList]
):
    message_type = AnalyticsQueryType.LIST_SHOP_DAILY_REPORTS

    def __init__(self, reader: AnalyticsReader) -> None:
        self._reader = reader

    async def execute(self, message: ListShopDailyReportsQuery) -> ShopDailyReportList:
        rows = await self._reader.shop_daily(message.shop_id, message.days)

        cashiers: defaultdict[date, list[ShopCashierDay]] = defaultdict(list)

        for row in rows.by_cashier:
            cashiers[row["day"]].append(
                ShopCashierDay(
                    cashier_id=row["cashier_id"],
                    cashier_name=row["cashier_name"],
                    tickets_sold=row["tickets_sold"],
                    sales=row["sales"],
                    payouts=row["payouts"],
                )
            )

        leagues: defaultdict[date, list[ShopLeagueDay]] = defaultdict(list)

        for row in rows.by_league:
            leagues[row["day"]].append(
                ShopLeagueDay(
                    league_name=row["league_name"],
                    tickets_sold=row["tickets_sold"],
                    sales=row["sales"],
                )
            )

        return ShopDailyReportList(
            items=[
                ShopDailyReport(
                    shop_id=message.shop_id,
                    date=row["day"].isoformat(),
                    tickets_sold=row["tickets_sold"],
                    sales=row["sales"],
                    payouts=row["payouts"],
                    cancellations=row["cancellations"],
                    open_tickets=row["open_tickets"],
                    # The till: cash taken minus cash paid out that day.
                    net=row["sales"] - row["payouts"],
                    by_cashier=cashiers[row["day"]],
                    by_league=leagues[row["day"]],
                )
                for row in rows.days
            ]
        )
