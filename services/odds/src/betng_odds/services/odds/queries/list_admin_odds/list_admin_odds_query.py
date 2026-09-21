from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import OddsQuery
from .....dtos import AdminMarketOddsList


@dataclass(frozen=True)
class ListAdminOddsQuery(Query[AdminMarketOddsList]):
    match_id: str | None

    type: str = OddsQuery.LIST_ADMIN_ODDS
