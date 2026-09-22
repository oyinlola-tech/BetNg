from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import SimulationQuery
from .....dtos import ReplayMatchResponse


@dataclass(frozen=True)
class ReplayMatchQuery(Query[ReplayMatchResponse]):
    match_id: str

    type: str = SimulationQuery.REPLAY_MATCH
