from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from betng_service_kit import QueryHandler

from .....constants import OddsQuery
from .....dtos import MatchOddsList
from .....interfaces import OddsRepository
from .....types import MarketRecord
from .....utils import to_match_odds
from .get_bulk_odds_query import GetBulkOddsQuery


@dataclass(frozen=True)
class GetBulkOddsHandler(QueryHandler[GetBulkOddsQuery, MatchOddsList]):
    repository: OddsRepository

    message_type = OddsQuery.GET_BULK_ODDS

    async def execute(self, message: GetBulkOddsQuery) -> MatchOddsList:
        match_ids = list(dict.fromkeys(message.match_ids))
        grouped: dict[str, list[MarketRecord]] = {
            match_id: [] for match_id in match_ids
        }

        for record in await self.repository.list_markets(match_ids):
            grouped[record.match_id].append(record)

        generated_at = datetime.now(UTC)

        return MatchOddsList(
            items=[
                to_match_odds(match_id, records, generated_at)
                for match_id, records in grouped.items()
            ]
        )
