from __future__ import annotations

from betng_service_kit import Container, QueryBus

from ...constants import ANALYTICS_READER_TOKEN
from .queries import (
    GetAccountAnalysisHandler,
    GetBreakdownHandler,
    GetExposureHandler,
    GetMatchAnalysisHandler,
    GetOperatorSummaryHandler,
    GetOverviewHandler,
    GetPlatformOverviewHandler,
    ListBetsHandler,
    ListDailyReportsHandler,
    ListSessionsHandler,
    ListShopDailyReportsHandler,
)


def register_analytics_service(container: Container, query_bus: QueryBus) -> None:
    reader = container.resolve(ANALYTICS_READER_TOKEN)

    for handler in (
        GetAccountAnalysisHandler(reader),
        GetBreakdownHandler(reader),
        GetExposureHandler(reader),
        GetMatchAnalysisHandler(reader),
        GetOperatorSummaryHandler(reader),
        GetOverviewHandler(reader),
        GetPlatformOverviewHandler(reader),
        ListBetsHandler(reader),
        ListDailyReportsHandler(reader),
        ListSessionsHandler(reader),
        ListShopDailyReportsHandler(reader),
    ):
        query_bus.register(handler)
