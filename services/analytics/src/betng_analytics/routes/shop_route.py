from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ..controllers import AnalyticsController
from ..dtos import (
    ShopDailyParams,
    ShopDailyReport,
    ShopDailyReportList,
    ShopRangeParams,
)
from ..middlewares import shop_report_guard


def create_shop_router(controller: AnalyticsController) -> APIRouter:
    router = APIRouter(prefix="/api/v1/shop", tags=["shop"])

    @router.get("/reports/daily", response_model=ShopDailyReport)
    async def daily_report(
        shop_id: Annotated[str, Depends(shop_report_guard)],
        params: Annotated[ShopDailyParams, Query()],
    ) -> ShopDailyReport:
        return await controller.shop_daily_report(shop_id, params.date)

    @router.get("/reports/daily/range", response_model=ShopDailyReportList)
    async def daily_reports(
        shop_id: Annotated[str, Depends(shop_report_guard)],
        params: Annotated[ShopRangeParams, Query()],
    ) -> ShopDailyReportList:
        return await controller.shop_daily_reports(shop_id, params.from_, params.to)

    return router
