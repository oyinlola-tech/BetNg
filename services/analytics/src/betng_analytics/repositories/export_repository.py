from __future__ import annotations

import logging
from datetime import datetime
from typing import Final

import psycopg
from betng_service_kit import Pool
from psycopg import IsolationLevel
from psycopg_pool import PoolTimeout

from ..errors import DatabaseUnavailableError
from ..types import ExportFilter, PagedReport, Row
from . import analytics_sql as sql

POOL_TIMEOUT_SECONDS = 5.0

#: report -> (page statement, capped count statement, keyset time column).
_STATEMENTS: Final[dict[PagedReport, tuple[str, str, str]]] = {
    "bets": (sql.EXPORT_BETS_SQL, sql.EXPORT_BETS_COUNT_SQL, "placed_at"),
    "audit": (sql.EXPORT_AUDIT_SQL, sql.EXPORT_AUDIT_COUNT_SQL, "created_at"),
}


class PostgresExportReader:
    """Keyset pages over one report; each page is its own short read."""

    def __init__(self, pool: Pool, logger: logging.Logger) -> None:
        self._pool = pool
        self._logger = logger

    def _params(self, report: PagedReport, where: ExportFilter) -> sql.Params:
        params: sql.Params = {"from": where.start, "to": where.end}

        if report == "bets":
            params["status"] = where.status
            params["channel"] = where.channel

        return params

    async def _rows(self, statement: str, params: sql.Params) -> list[Row]:
        try:
            async with self._pool.connection(POOL_TIMEOUT_SECONDS) as connection:
                await connection.set_read_only(True)
                await connection.set_isolation_level(IsolationLevel.READ_COMMITTED)
                cursor = await connection.execute(statement.encode("utf-8"), params)
                return await cursor.fetchall()
        except (psycopg.Error, PoolTimeout) as error:
            self._logger.error(
                "Analytics export read failed",
                extra={"event": "export_read_failed", "error": type(error).__name__},
            )
            raise DatabaseUnavailableError from error

    async def count(self, report: PagedReport, where: ExportFilter, cap: int) -> int:
        params = {**self._params(report, where), "cap": cap}
        rows = await self._rows(_STATEMENTS[report][1], params)

        return int(rows[0]["total"])

    async def page(
        self,
        report: PagedReport,
        where: ExportFilter,
        after: tuple[datetime, str] | None,
        limit: int,
    ) -> list[Row]:
        params = {
            **self._params(report, where),
            "after_at": None if after is None else after[0],
            "after_id": None if after is None else after[1],
            "limit": limit,
        }

        return await self._rows(_STATEMENTS[report][0], params)

    @staticmethod
    def cursor_of(report: PagedReport, row: Row) -> tuple[datetime, str]:
        moment: datetime = row[_STATEMENTS[report][2]]

        return moment, str(row["id"])
