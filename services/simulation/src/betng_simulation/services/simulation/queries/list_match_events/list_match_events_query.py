"""List match events query."""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import SimulationQuery
from .....dtos import MatchEventList


@dataclass(frozen=True)
class ListMatchEventsQuery(Query[MatchEventList]):
    """Internal read of a match's whole timeline, revealed or not."""

    match_id: str

    type: str = SimulationQuery.LIST_MATCH_EVENTS
