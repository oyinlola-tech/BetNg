from __future__ import annotations

import csv
import io
import json
import logging
from collections.abc import AsyncIterator, Sequence
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any, Final
from uuid import UUID
from zoneinfo import ZoneInfo

from betng_service_kit import QueryHandler

from .....constants import EXPORT_PAGE_SIZE, MAX_EXPORT_ROWS, AnalyticsQueryType
from .....errors import InvalidQueryError
from .....interfaces import AnalyticsReader, ExportReader
from .....types import ExportFilter, PagedReport, Row
from .....utils import operator_result, to_iso
from .export_report_query import ExportReportQuery, ExportStream

_FORMULA_PREFIXES: Final = ("=", "+", "-", "@", "\t", "\r")

#: report -> (header, row column per header cell).
_COLUMNS: Final[dict[str, tuple[tuple[str, str], ...]]] = {
    "daily": (
        ("date", "day"),
        ("bets", "bets"),
        ("stakeKobo", "stake"),
        ("payoutsKobo", "payout"),
        ("netKobo", "net"),
        ("onlineStakeKobo", "online_stake"),
        ("shopStakeKobo", "shop_stake"),
    ),
    "bets": (
        ("id", "id"),
        ("placedAt", "placed_at"),
        ("channel", "channel"),
        ("status", "status"),
        ("stakeKobo", "stake"),
        ("totalOdds", "total_odds"),
        ("potentialPayoutKobo", "potential_payout"),
        ("payoutKobo", "payout"),
        ("currency", "currency"),
        ("customerId", "user_id"),
        ("shopId", "shop_id"),
        ("cashierId", "cashier_id"),
        ("settledAt", "settled_at"),
        ("cancelledAt", "cancelled_at"),
    ),
    "audit": (
        ("id", "id"),
        ("timestamp", "created_at"),
        ("actorId", "actor_id"),
        ("actorRole", "actor_role"),
        ("actorName", "actor_name"),
        ("action", "action"),
        ("resource", "entity_type"),
        ("resourceId", "entity_id"),
        ("severity", "severity"),
        ("reason", "reason"),
        ("requestId", "request_id"),
        ("before", "before"),
        ("after", "after"),
    ),
}


def csv_cell(value: Any) -> str:
    """Render one cell; text that a spreadsheet would run as a formula is defused."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int | Decimal):
        return str(value)
    if isinstance(value, datetime):
        return to_iso(value)
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)

    text = (
        value
        if isinstance(value, str)
        else json.dumps(value, sort_keys=True, default=str, ensure_ascii=False)
    )

    return f"'{text}" if text.startswith(_FORMULA_PREFIXES) else text


def csv_lines(rows: Sequence[Sequence[str]]) -> bytes:
    buffer = io.StringIO()
    csv.writer(buffer, lineterminator="\r\n").writerows(rows)

    return buffer.getvalue().encode("utf-8")


class ExportReportHandler(QueryHandler[ExportReportQuery, ExportStream]):
    message_type = AnalyticsQueryType.EXPORT_REPORT

    def __init__(
        self,
        reader: AnalyticsReader,
        exports: ExportReader,
        report_timezone: str,
        logger: logging.Logger,
    ) -> None:
        self._reader = reader
        self._exports = exports
        self._zone = ZoneInfo(report_timezone)
        self._logger = logger

    def _encode(self, report: str, rows: Sequence[Row]) -> bytes:
        columns = _COLUMNS[report]

        return csv_lines(
            [[csv_cell(row.get(key)) for _, key in columns] for row in rows]
        )

    async def execute(self, message: ExportReportQuery) -> ExportStream:
        days = message.days
        filename = f"betng-{message.report}-{days.first:%Y%m%d}-{days.last:%Y%m%d}.csv"
        header = csv_lines([[name for name, _ in _COLUMNS[message.report]]])

        if message.report == "daily":
            rows = [
                {**row, "net": operator_result(row["settled_stake"], row["payout"])}
                for row in await self._reader.daily_reports(days)
            ]
            body = header + self._encode("daily", rows)

            async def single() -> AsyncIterator[bytes]:
                yield body

            return ExportStream(filename, single())

        report: PagedReport = message.report
        where = ExportFilter(
            start=datetime.combine(days.first, time.min, self._zone),
            end=datetime.combine(days.last + timedelta(days=1), time.min, self._zone),
            status=message.status,
            channel=message.channel,
        )

        total = await self._exports.count(report, where, MAX_EXPORT_ROWS + 1)
        if total > MAX_EXPORT_ROWS:
            raise InvalidQueryError(
                "from",
                f"An export holds at most {MAX_EXPORT_ROWS} rows; narrow the range.",
            )

        first = await self._exports.page(report, where, None, EXPORT_PAGE_SIZE)

        return ExportStream(filename, self._stream(report, where, header, first))

    async def _stream(
        self,
        report: PagedReport,
        where: ExportFilter,
        header: bytes,
        rows: list[Row],
    ) -> AsyncIterator[bytes]:
        yield header
        sent = 0

        while rows:
            rows = rows[: MAX_EXPORT_ROWS - sent]
            yield self._encode(report, rows)
            sent += len(rows)

            if len(rows) < EXPORT_PAGE_SIZE or sent >= MAX_EXPORT_ROWS:
                break

            after = self._exports.cursor_of(report, rows[-1])
            rows = await self._exports.page(report, where, after, EXPORT_PAGE_SIZE)

        self._logger.info(
            "Report exported",
            extra={"event": "report_exported", "report": report, "rows": sent},
        )
