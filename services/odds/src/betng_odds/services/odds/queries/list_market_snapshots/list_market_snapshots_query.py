"""Read a market's snapshot history."""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import OddsQuery
from .....dtos import OddsSnapshotList


@dataclass(frozen=True)
class ListMarketSnapshotsQuery(Query[OddsSnapshotList]):
    """Every version a market has had, oldest first."""

    market_id: str

    type: str = OddsQuery.LIST_MARKET_SNAPSHOTS
