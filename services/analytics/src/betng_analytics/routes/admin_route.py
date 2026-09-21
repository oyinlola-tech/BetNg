from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..constants import REPORTS_READ
from ..controllers import AnalyticsController
from ..dtos import (
    AccountAnalysis,
    AnalyticsBreakdown,
    AnalyticsOverview,
    BreakdownParams,
    DailyReportParams,
    MatchAnalysis,
    PlatformOverview,
    PlatformReportDayList,
    SessionAnalysisList,
    SessionsParams,
    WindowParams,
)
from ..middlewares import admin_guard


def create_admin_router(controller: AnalyticsController) -> APIRouter:
    router = APIRouter(prefix="/api/v1/admin", tags=["admin"])
    any_admin = Depends(admin_guard())
    reports_reader = Depends(admin_guard(REPORTS_READ))

    @router.get("/overview", response_model=PlatformOverview, dependencies=[any_admin])
    async def platform_overview() -> PlatformOverview:
        return await controller.platform_overview()

    @router.get(
        "/reports/daily",
        response_model=PlatformReportDayList,
        dependencies=[reports_reader],
    )
    async def daily_reports(
        params: Annotated[DailyReportParams, Query()],
    ) -> PlatformReportDayList:
        return await controller.daily_reports(params)

    @router.get(
        "/analytics/overview",
        response_model=AnalyticsOverview,
        response_model_exclude_none=True,
        dependencies=[reports_reader],
    )
    async def overview(params: Annotated[WindowParams, Query()]) -> AnalyticsOverview:
        return await controller.overview(params)

    @router.get(
        "/analytics/breakdown",
        response_model=AnalyticsBreakdown,
        response_model_exclude_none=True,
        dependencies=[reports_reader],
    )
    async def breakdown(
        params: Annotated[BreakdownParams, Query()],
    ) -> AnalyticsBreakdown:
        return await controller.breakdown(params)

    @router.get(
        "/analytics/sessions",
        response_model=SessionAnalysisList,
        dependencies=[reports_reader],
    )
    async def sessions(
        params: Annotated[SessionsParams, Query()],
    ) -> SessionAnalysisList:
        return await controller.sessions(params)

    @router.get(
        "/analytics/matches/{match_id}",
        response_model=MatchAnalysis,
        response_model_exclude_none=True,
        dependencies=[reports_reader],
    )
    async def match_analysis(match_id: UUID) -> MatchAnalysis:
        return await controller.match_analysis(match_id)

    @router.get(
        "/analytics/accounts/{customer_id}",
        response_model=AccountAnalysis,
        response_model_exclude_none=True,
        dependencies=[reports_reader],
    )
    async def customer_analysis(
        customer_id: UUID,
        params: Annotated[WindowParams, Query()],
    ) -> AccountAnalysis:
        return await controller.account("CUSTOMER", customer_id, params)

    @router.get(
        "/analytics/shops/{shop_id}",
        response_model=AccountAnalysis,
        response_model_exclude_none=True,
        dependencies=[reports_reader],
    )
    async def shop_analysis(
        shop_id: UUID,
        params: Annotated[WindowParams, Query()],
    ) -> AccountAnalysis:
        return await controller.account("SHOP", shop_id, params)

    @router.get(
        "/analytics/cashiers/{cashier_id}",
        response_model=AccountAnalysis,
        response_model_exclude_none=True,
        dependencies=[reports_reader],
    )
    async def cashier_analysis(
        cashier_id: UUID,
        params: Annotated[WindowParams, Query()],
    ) -> AccountAnalysis:
        return await controller.account("CASHIER", cashier_id, params)

    return router
