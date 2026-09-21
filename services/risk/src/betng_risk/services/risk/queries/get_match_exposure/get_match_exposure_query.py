from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import RiskQuery
from .....dtos import MatchExposure


@dataclass(frozen=True)
class GetMatchExposureQuery(Query[MatchExposure]):
    """Asks for one match's exposure."""

    match_id: str

    type: str = RiskQuery.GET_MATCH_EXPOSURE
