from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import AnalyticsQueryType
from .....dtos import PlatformReportDayList
from .....types import DayRange


@dataclass(frozen=True)
class ListDailyReportsQuery(Query[PlatformReportDayList]):
    days: DayRange

    type: str = AnalyticsQueryType.LIST_DAILY_REPORTS
