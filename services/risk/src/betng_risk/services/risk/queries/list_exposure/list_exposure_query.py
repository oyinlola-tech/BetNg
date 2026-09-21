from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import RiskQuery
from .....dtos import MatchExposureList


@dataclass(frozen=True)
class ListExposureQuery(Query[MatchExposureList]):
    type: str = RiskQuery.LIST_EXPOSURE
