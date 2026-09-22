from __future__ import annotations

from datetime import datetime
from typing import Protocol

from ..types import (
    BetPageRows,
    BetScope,
    DayRange,
    ExportFilter,
    ExposureRows,
    MatchAnalysisRows,
    PagedReport,
    ReaderDimension,
    Row,
    SessionKind,
    ShopDailyRows,
    SubjectKind,
    Window,
)


class AnalyticsReader(Protocol):
    async def overview(self, scope: BetScope) -> Row: ...

    async def bets(self, scope: BetScope, page: int, page_size: int) -> BetPageRows: ...

    async def match_analysis(self, match_id: str) -> MatchAnalysisRows | None: ...

    async def breakdown(
        self, dimension: ReaderDimension, scope: BetScope, limit: int
    ) -> list[Row]: ...

    async def exposure(self, scope: BetScope, limit: int) -> ExposureRows: ...

    async def operator(self, scope: BetScope) -> Row: ...

    async def platform_overview(self) -> Row: ...

    async def daily_reports(self, days: DayRange) -> list[Row]: ...

    async def sessions(
        self, kind: SessionKind, scope: BetScope, limit: int
    ) -> list[Row]: ...

    async def account(
        self, kind: SubjectKind, subject_id: str, window: Window
    ) -> Row | None: ...

    async def shop_daily(self, shop_id: str, days: DayRange) -> ShopDailyRows: ...


class ExportReader(Protocol):
    async def count(
        self, report: PagedReport, where: ExportFilter, cap: int
    ) -> int: ...

    async def page(
        self,
        report: PagedReport,
        where: ExportFilter,
        after: tuple[datetime, str] | None,
        limit: int,
    ) -> list[Row]: ...

    def cursor_of(self, report: PagedReport, row: Row) -> tuple[datetime, str]: ...
