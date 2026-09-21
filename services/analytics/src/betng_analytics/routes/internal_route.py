from __future__ import annotations

from typing import Annotated
from uuid import UUID

from betng_service_kit import require_internal
from fastapi import APIRouter, Depends, Query

from ..controllers import AnalyticsController
from ..dtos import (
    AnalyticsOverview,
    BetPage,
    BetsParams,
    ExposureParams,
    ExposureReport,
    MatchAnalysis,
    OperatorReconciliation,
    WindowParams,
)


def create_internal_router(controller: AnalyticsController) -> APIRouter:
    router = APIRouter(
        prefix="/internal/analytics",
        tags=["internal"],
        dependencies=[Depends(require_internal)],
    )

    @router.get(
        "/overview",
        response_model=AnalyticsOverview,
        response_model_exclude_none=True,
        summary="Global bet analysis of a window",
    )
    async def overview(
        params: Annotated[WindowParams, Query()],
    ) -> AnalyticsOverview:
        return await controller.overview(params)

    @router.get(
        "/bets",
        response_model=BetPage,
        response_model_exclude_none=True,
        summary="Accepted bets with their legs, newest first",
    )
    async def bets(params: Annotated[BetsParams, Query()]) -> BetPage:
        return await controller.bets(params)

    @router.get(
        "/matches/{match_id}",
        response_model=MatchAnalysis,
        response_model_exclude_none=True,
        summary="How the global bets fell on one match",
    )
    async def match_analysis(match_id: UUID) -> MatchAnalysis:
        return await controller.match_analysis(match_id)

    @router.get(
        "/exposure",
        response_model=ExposureReport,
        response_model_exclude_none=True,
        summary="Pending liability by match, market and selection",
    )
    async def exposure(
        params: Annotated[ExposureParams, Query()],
    ) -> ExposureReport:
        return await controller.exposure(params)

    @router.get(
        "/operator",
        response_model=OperatorReconciliation,
        response_model_exclude_none=True,
        summary="Live operator result, reconciled against the ledger",
    )
    async def operator(
        params: Annotated[WindowParams, Query()],
    ) -> OperatorReconciliation:
        return await controller.operator(params)

    return router
