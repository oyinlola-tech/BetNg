from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import SimulationQuery
from .....dtos import GetSquadsRequest, SquadsResponse


@dataclass(frozen=True)
class GetSquadsQuery(Query[SquadsResponse]):
    request: GetSquadsRequest

    type: str = SimulationQuery.GET_SQUADS
