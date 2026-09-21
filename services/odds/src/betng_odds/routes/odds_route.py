from __future__ import annotations

from typing import Annotated
from uuid import UUID

from betng_service_kit import Actor, get_request_id, require_internal
from fastapi import APIRouter, Depends, Query, Request

from ..constants import MAX_BULK_MATCH_IDS, OddsPermission
from ..controllers import OddsController
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
from ..middlewares import require_permission

API_PREFIX = "/api/v1"
INTERNAL_PREFIX = "/internal/odds"

_MATCH_IDS_MAX_LENGTH = MAX_BULK_MATCH_IDS * 37 + 64

OddsReader = Annotated[Actor, Depends(require_permission(OddsPermission.READ))]
OddsWriter = Annotated[Actor, Depends(require_permission(OddsPermission.WRITE))]


def create_odds_router(controller: OddsController) -> APIRouter:
    router = APIRouter()
    public = APIRouter(prefix=API_PREFIX, tags=["odds"])
    admin = APIRouter(prefix=f"{API_PREFIX}/admin", tags=["admin"])
    # Never proxied; answers 404 without the internal service token.
    internal = APIRouter(
        prefix=INTERNAL_PREFIX,
        tags=["internal"],
        dependencies=[Depends(require_internal)],
    )

    @public.get(
        "/matches/{match_id}/odds",
        response_model=MatchOdds,
        response_model_exclude_none=True,
        summary="Read a match's markets and odds",
    )
    async def get_match_odds(match_id: UUID) -> MatchOdds:
        return await controller.get_match_odds(match_id)

    @public.get(
        "/odds",
        response_model=MatchOddsList,
        response_model_exclude_none=True,
        summary="Read several matches' markets and odds",
    )
    async def get_bulk_odds(
        match_ids: Annotated[
            str,
            Query(alias="matchIds", min_length=1, max_length=_MATCH_IDS_MAX_LENGTH),
        ],
    ) -> MatchOddsList:
        return await controller.get_bulk_odds(match_ids)

    @admin.get(
        "/odds",
        response_model=AdminMarketOddsList,
        summary="Trading view: markets, margin and pending exposure",
    )
    async def list_admin_odds(
        _actor: OddsReader,
        match_id: Annotated[UUID | None, Query(alias="matchId")] = None,
    ) -> AdminMarketOddsList:
        return await controller.list_admin_odds(match_id)

    @admin.post(
        "/markets/{market_id}/actions",
        response_model=AdminMarketOdds,
        summary="Suspend or resume a market",
    )
    async def apply_market_action(
        market_id: UUID,
        body: MarketAdminActionRequest,
        actor: OddsWriter,
        request: Request,
    ) -> AdminMarketOdds:
        return await controller.apply_market_action(
            market_id, body, actor, get_request_id(request)
        )

    @admin.get(
        "/odds/config",
        response_model=PricingConfigurationView,
        summary="Read the active pricing configuration",
    )
    async def get_pricing_configuration(_actor: OddsReader) -> PricingConfigurationView:
        return await controller.get_pricing_configuration()

    @admin.put(
        "/odds/config",
        response_model=PricingConfigurationView,
        summary="Store a new pricing configuration version",
    )
    async def update_pricing_configuration(
        body: UpdatePricingConfigurationRequest,
        actor: OddsWriter,
        request: Request,
    ) -> PricingConfigurationView:
        return await controller.update_pricing_configuration(
            body, actor, get_request_id(request)
        )

    @internal.get(
        "/markets/{market_id}/snapshots",
        response_model=OddsSnapshotList,
        summary="Read a market's immutable snapshot history",
    )
    async def list_market_snapshots(market_id: UUID) -> OddsSnapshotList:
        return await controller.list_market_snapshots(market_id)

    router.include_router(public)
    router.include_router(admin)
    router.include_router(internal)

    return router
