"""Markets with their opening prices, measured margin and pending exposure."""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import QueryHandler

from .....constants import ADMIN_TRADING_MARKET_LIMIT, OddsQuery
from .....dtos import AdminMarketOddsList
from .....interfaces import ExposureReader, MatchDirectory, OddsRepository
from .....utils import to_admin_market
from .list_admin_odds_query import ListAdminOddsQuery


@dataclass(frozen=True)
class ListAdminOddsHandler(QueryHandler[ListAdminOddsQuery, AdminMarketOddsList]):
    """Join the odds rows with the match and betting read models."""

    repository: OddsRepository
    match_directory: MatchDirectory
    exposure_reader: ExposureReader

    message_type = OddsQuery.LIST_ADMIN_ODDS

    async def execute(self, message: ListAdminOddsQuery) -> AdminMarketOddsList:
        """Return the admin view of the selected markets."""
        if message.match_id is None:
            records = await self.repository.list_trading_markets(
                ADMIN_TRADING_MARKET_LIMIT
            )
        else:
            records = await self.repository.list_markets([message.match_id])

        market_ids = [record.id for record in records]
        matches = await self.match_directory.find(
            list({record.match_id for record in records})
        )
        opening = await self.repository.opening_odds(market_ids)
        exposure = await self.exposure_reader.by_selection(market_ids)

        return AdminMarketOddsList(
            items=[
                to_admin_market(record, matches.get(record.match_id), opening, exposure)
                for record in records
            ]
        )
