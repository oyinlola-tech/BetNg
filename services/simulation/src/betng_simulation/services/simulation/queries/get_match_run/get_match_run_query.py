from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import SimulationQuery
from .....dtos import MatchRunDetail


@dataclass(frozen=True)
class GetMatchRunQuery(Query[MatchRunDetail]):
    """Internal read of a match's run and result. Never served to the gateway."""

    match_id: str

    type: str = SimulationQuery.GET_MATCH_RUN
