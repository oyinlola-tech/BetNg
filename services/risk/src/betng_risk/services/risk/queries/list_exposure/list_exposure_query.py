"""The exposure dashboard query."""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import RiskQuery
from .....dtos import MatchExposureList


@dataclass(frozen=True)
class ListExposureQuery(Query[MatchExposureList]):
    """Asks for every match the book is, or can still become, exposed on."""

    type: str = RiskQuery.LIST_EXPOSURE
