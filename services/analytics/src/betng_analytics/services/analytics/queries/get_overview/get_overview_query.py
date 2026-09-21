from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import AnalyticsQueryType
from .....dtos import AnalyticsOverview
from .....types import BetScope


@dataclass(frozen=True)
class GetOverviewQuery(Query[AnalyticsOverview]):
    """Asks for the global bet analysis of a window.

    The scope narrows by time only; it is never the caller's own bets.
    """

    scope: BetScope

    type: str = AnalyticsQueryType.GET_OVERVIEW
