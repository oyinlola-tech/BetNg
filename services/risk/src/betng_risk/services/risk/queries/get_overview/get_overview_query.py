from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import RiskQuery
from .....dtos import RiskOverview


@dataclass(frozen=True)
class GetOverviewQuery(Query[RiskOverview]):
    type: str = RiskQuery.GET_OVERVIEW
