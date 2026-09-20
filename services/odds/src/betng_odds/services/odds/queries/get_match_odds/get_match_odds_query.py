"""The query that reads a match's current markets."""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import OddsQuery


@dataclass(frozen=True)
class GetMatchOddsQuery(Query):
    """Asks for the markets currently priced for a match."""

    match_id: str

    type: str = OddsQuery.GET_MATCH_ODDS
