from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import AnalyticsQueryType
from .....dtos import PlatformOverview


@dataclass(frozen=True)
class GetPlatformOverviewQuery(Query[PlatformOverview]):
    type: str = AnalyticsQueryType.GET_PLATFORM_OVERVIEW
