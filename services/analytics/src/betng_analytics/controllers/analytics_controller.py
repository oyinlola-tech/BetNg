from __future__ import annotations

from uuid import UUID

from betng_service_kit import QueryBus

from ..dtos import (
    AccountAnalysis,
    AnalyticsBreakdown,
    AnalyticsOverview,
    BetPage,
    BetsParams,
    BreakdownParams,
    DailyReportParams,
    ExposureParams,
    ExposureReport,
    MatchAnalysis,
    OperatorReconciliation,
    PlatformOverview,
    PlatformReportDayList,
    SessionAnalysisList,
    SessionsParams,
    ShopDailyReport,
    ShopDailyReportList,
    WindowParams,
)
from ..services.analytics.queries import (
    GetAccountAnalysisQuery,
    GetBreakdownQuery,
    GetExposureQuery,
    GetMatchAnalysisQuery,
    GetOperatorSummaryQuery,
    GetOverviewQuery,
    GetPlatformOverviewQuery,
    ListBetsQuery,
    ListDailyReportsQuery,
    ListSessionsQuery,
    ListShopDailyReportsQuery,
)
from ..types import BetScope, SubjectKind
from ..validators import validate_day, validate_days, validate_window


def _text(value: UUID | None) -> str | None:
    return None if value is None else str(value)


class AnalyticsController:
    def __init__(self, query_bus: QueryBus, report_timezone: str) -> None:
        self._query_bus = query_bus
        self._timezone = report_timezone

    async def overview(self, params: WindowParams) -> AnalyticsOverview:
        scope = BetScope(window=validate_window(params.from_, params.to))

        return await self._query_bus.execute(GetOverviewQuery(scope))

    async def bets(self, params: BetsParams) -> BetPage:
        scope = BetScope(
            window=validate_window(params.from_, params.to),
            status=params.status,
            channel=params.channel,
            shop_id=_text(params.shop_id),
            user_id=_text(params.user_id),
            match_id=_text(params.match_id),
        )

        return await self._query_bus.execute(
            ListBetsQuery(scope, params.page, params.page_size)
        )

    async def match_analysis(self, match_id: UUID) -> MatchAnalysis:
        return await self._query_bus.execute(GetMatchAnalysisQuery(str(match_id)))

    async def exposure(self, params: ExposureParams) -> ExposureReport:
        scope = BetScope(
            league_id=_text(params.league_id),
            match_id=_text(params.match_id),
            shop_id=_text(params.shop_id),
        )

        return await self._query_bus.execute(GetExposureQuery(scope, params.limit))

    async def operator(self, params: WindowParams) -> OperatorReconciliation:
        scope = BetScope(window=validate_window(params.from_, params.to))

        return await self._query_bus.execute(GetOperatorSummaryQuery(scope))

    async def platform_overview(self) -> PlatformOverview:
        return await self._query_bus.execute(GetPlatformOverviewQuery())

    async def daily_reports(self, params: DailyReportParams) -> PlatformReportDayList:
        days = validate_days(params.from_, params.to, self._timezone)

        return await self._query_bus.execute(ListDailyReportsQuery(days))

    async def breakdown(self, params: BreakdownParams) -> AnalyticsBreakdown:
        scope = BetScope(
            window=validate_window(params.from_, params.to),
            league_id=_text(params.league_id),
            match_id=_text(params.match_id),
            shop_id=_text(params.shop_id),
        )

        return await self._query_bus.execute(
            GetBreakdownQuery(params.by, scope, params.limit)
        )

    async def sessions(self, params: SessionsParams) -> SessionAnalysisList:
        scope = BetScope(
            window=validate_window(params.from_, params.to),
            league_id=_text(params.league_id),
        )

        return await self._query_bus.execute(
            ListSessionsQuery(params.kind, scope, params.limit)
        )

    async def account(
        self, kind: SubjectKind, subject_id: UUID, params: WindowParams
    ) -> AccountAnalysis:
        window = validate_window(params.from_, params.to)

        return await self._query_bus.execute(
            GetAccountAnalysisQuery(kind, str(subject_id), window)
        )

    async def shop_daily_report(self, shop_id: str, day: str | None) -> ShopDailyReport:
        days = validate_day(day, self._timezone)
        reports = await self._query_bus.execute(
            ListShopDailyReportsQuery(shop_id, days)
        )

        return reports.items[0]

    async def shop_daily_reports(
        self, shop_id: str, first: str | None, last: str | None
    ) -> ShopDailyReportList:
        days = validate_days(first, last, self._timezone)

        return await self._query_bus.execute(ListShopDailyReportsQuery(shop_id, days))
