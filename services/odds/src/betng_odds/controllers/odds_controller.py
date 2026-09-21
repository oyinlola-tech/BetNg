from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from betng_service_kit import Actor, CommandBus, QueryBus

from ..dtos import (
    AdminMarketOdds,
    AdminMarketOddsList,
    MarketAdminActionRequest,
    MatchOdds,
    MatchOddsList,
    OddsSnapshotList,
    PricingConfigurationView,
    UpdatePricingConfigurationRequest,
)
from ..services.odds.commands import (
    ApplyMarketActionCommand,
    UpdatePricingConfigurationCommand,
)
from ..services.odds.queries import (
    GetBulkOddsQuery,
    GetMatchOddsQuery,
    GetPricingConfigurationQuery,
    ListAdminOddsQuery,
    ListMarketSnapshotsQuery,
)
from ..validators import parse_match_ids


@dataclass(frozen=True)
class OddsController:
    command_bus: CommandBus
    query_bus: QueryBus

    async def get_match_odds(self, match_id: UUID) -> MatchOdds:
        return await self.query_bus.execute(GetMatchOddsQuery(str(match_id)))

    async def get_bulk_odds(self, raw_match_ids: str) -> MatchOddsList:
        return await self.query_bus.execute(
            GetBulkOddsQuery(parse_match_ids(raw_match_ids))
        )

    async def list_admin_odds(self, match_id: UUID | None) -> AdminMarketOddsList:
        return await self.query_bus.execute(
            ListAdminOddsQuery(None if match_id is None else str(match_id))
        )

    async def apply_market_action(
        self,
        market_id: UUID,
        request: MarketAdminActionRequest,
        actor: Actor,
        request_id: str,
    ) -> AdminMarketOdds:
        return await self.command_bus.execute(
            ApplyMarketActionCommand(str(market_id), request, actor, request_id)
        )

    async def get_pricing_configuration(self) -> PricingConfigurationView:
        return await self.query_bus.execute(GetPricingConfigurationQuery())

    async def update_pricing_configuration(
        self,
        request: UpdatePricingConfigurationRequest,
        actor: Actor,
        request_id: str,
    ) -> PricingConfigurationView:
        return await self.command_bus.execute(
            UpdatePricingConfigurationCommand(request, actor, request_id)
        )

    async def list_market_snapshots(self, market_id: UUID) -> OddsSnapshotList:
        return await self.query_bus.execute(ListMarketSnapshotsQuery(str(market_id)))
