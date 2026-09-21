from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import AnalyticsQueryType
from .....dtos import BetPage
from .....types import BetScope


@dataclass(frozen=True)
class ListBetsQuery(Query[BetPage]):
    scope: BetScope
    page: int
    page_size: int

    type: str = AnalyticsQueryType.LIST_BETS
