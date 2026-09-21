from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import AnalyticsQueryType
from .....dtos import AnalyticsBreakdown
from .....types import BetScope, Dimension


@dataclass(frozen=True)
class GetBreakdownQuery(Query[AnalyticsBreakdown]):
    """Asks for the global bets split along one dimension."""

    dimension: Dimension
    scope: BetScope
    limit: int

    type: str = AnalyticsQueryType.GET_BREAKDOWN
