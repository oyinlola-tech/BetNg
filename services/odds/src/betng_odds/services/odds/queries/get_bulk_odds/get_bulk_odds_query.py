from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import OddsQuery
from .....dtos import MatchOddsList


@dataclass(frozen=True)
class GetBulkOddsQuery(Query[MatchOddsList]):
    match_ids: tuple[str, ...]

    type: str = OddsQuery.GET_BULK_ODDS
