"""The limits query."""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import RiskQuery
from .....dtos import RiskLimits


@dataclass(frozen=True)
class GetLimitsQuery(Query[RiskLimits]):
    """Asks for the limits version in force."""

    type: str = RiskQuery.GET_LIMITS
