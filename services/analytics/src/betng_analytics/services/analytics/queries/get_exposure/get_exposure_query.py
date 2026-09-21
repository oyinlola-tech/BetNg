from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import AnalyticsQueryType
from .....dtos import ExposureReport
from .....types import BetScope


@dataclass(frozen=True)
class GetExposureQuery(Query[ExposureReport]):
    scope: BetScope
    limit: int

    type: str = AnalyticsQueryType.GET_EXPOSURE
