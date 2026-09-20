"""The handler behind ``GET /api/v1/matches/{matchId}/odds``."""

from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import OddsQuery
from .....dtos import MatchOdds
from .....interfaces import OddsPricer
from .get_match_odds_query import GetMatchOddsQuery


class GetMatchOddsHandler(QueryHandler[GetMatchOddsQuery, MatchOdds]):
    """Reads a match's current markets."""

    message_type = OddsQuery.GET_MATCH_ODDS

    def __init__(self, pricer: OddsPricer) -> None:
        """Read through the given pricer."""
        self._pricer = pricer

    async def execute(self, message: GetMatchOddsQuery) -> MatchOdds:
        """Return the markets currently priced for the match."""
        return await self._pricer.current(message.match_id)
