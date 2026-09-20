from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import OddsQuery


@dataclass(frozen=True)
class GetMatchOddsQuery(Query):
    match_id: str

    type: str = OddsQuery.GET_MATCH_ODDS
