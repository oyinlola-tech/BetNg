from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import AnalyticsQueryType
from .....types import DayRange, ExportReport


@dataclass(frozen=True)
class ExportStream:
    filename: str
    chunks: AsyncIterator[bytes]


@dataclass(frozen=True)
class ExportReportQuery(Query[ExportStream]):
    report: ExportReport
    days: DayRange
    status: str | None = None
    channel: str | None = None

    type: str = AnalyticsQueryType.EXPORT_REPORT
