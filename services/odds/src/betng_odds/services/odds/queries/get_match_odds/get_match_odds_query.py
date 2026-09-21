from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import OddsQuery
from .....dtos import MatchOdds


@dataclass(frozen=True)
class GetMatchOddsQuery(Query[MatchOdds]):
    match_id: str

    type: str = OddsQuery.GET_MATCH_ODDS
