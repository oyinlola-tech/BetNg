from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import AnalyticsQueryType
from .....dtos import AnalyticsOverview
from .....types import BetScope


@dataclass(frozen=True)
class GetOverviewQuery(Query[AnalyticsOverview]):
    scope: BetScope

    type: str = AnalyticsQueryType.GET_OVERVIEW
