"""One match's odds, from the rows every reader shares."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from betng_service_kit import QueryHandler

from .....constants import OddsQuery
from .....dtos import MatchOdds
from .....interfaces import OddsRepository
from .....utils import to_match_odds
from .get_match_odds_query import GetMatchOddsQuery


@dataclass(frozen=True)
class GetMatchOddsHandler(QueryHandler[GetMatchOddsQuery, MatchOdds]):
    """Return stored markets; a match with none answers an empty list."""

    repository: OddsRepository

    message_type = OddsQuery.GET_MATCH_ODDS

    async def execute(self, message: GetMatchOddsQuery) -> MatchOdds:
        """Read the match's markets."""
        records = await self.repository.list_markets([message.match_id])

        return to_match_odds(message.match_id, records, datetime.now(UTC))
