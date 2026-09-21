from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import AnalyticsQueryType
from .....dtos import ShopDailyReportList
from .....types import DayRange


@dataclass(frozen=True)
class ListShopDailyReportsQuery(Query[ShopDailyReportList]):
    shop_id: str
    days: DayRange

    type: str = AnalyticsQueryType.LIST_SHOP_DAILY_REPORTS
