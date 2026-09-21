from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import QueryHandler

from .....constants import SNAPSHOT_HISTORY_LIMIT, OddsQuery
from .....dtos import OddsSnapshotList
from .....errors import MarketNotFoundError
from .....interfaces import OddsRepository
from .....utils import to_snapshot
from .list_market_snapshots_query import ListMarketSnapshotsQuery


@dataclass(frozen=True)
class ListMarketSnapshotsHandler(
    QueryHandler[ListMarketSnapshotsQuery, OddsSnapshotList]
):
    repository: OddsRepository

    message_type = OddsQuery.LIST_MARKET_SNAPSHOTS

    async def execute(self, message: ListMarketSnapshotsQuery) -> OddsSnapshotList:
        snapshots = await self.repository.list_snapshots(
            message.market_id, SNAPSHOT_HISTORY_LIMIT
        )

        if not snapshots:
            raise MarketNotFoundError(message.market_id)

        return OddsSnapshotList(items=[to_snapshot(record) for record in snapshots])
