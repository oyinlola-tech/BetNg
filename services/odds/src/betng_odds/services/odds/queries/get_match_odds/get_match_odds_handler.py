from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import OddsQuery
from .....dtos import MatchOdds
from .....interfaces import OddsPricer
from .get_match_odds_query import GetMatchOddsQuery


class GetMatchOddsHandler(QueryHandler[GetMatchOddsQuery, MatchOdds]):
    message_type = OddsQuery.GET_MATCH_ODDS

    def __init__(self, pricer: OddsPricer) -> None:
        self._pricer = pricer

    async def execute(self, message: GetMatchOddsQuery) -> MatchOdds:
        return await self._pricer.current(message.match_id)
