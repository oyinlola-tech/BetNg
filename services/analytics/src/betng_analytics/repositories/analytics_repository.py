"""The PostgreSQL analytics reader.

Every method issues ``SELECT`` statements and nothing else. A request that
needs several statements runs them in one ``REPEATABLE READ`` read-only
transaction, so the figures of one answer describe one instant of the book.

A database failure is never papered over: it becomes ``DATABASE_UNAVAILABLE``.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import replace

import psycopg
from betng_service_kit import Pool
from psycopg import AsyncConnection, IsolationLevel
from psycopg.rows import DictRow
from psycopg_pool import PoolTimeout

from ..constants import ACTIVE_USER_WINDOW_MINUTES
from ..errors import DatabaseUnavailableError
from ..interfaces import AnalyticsReader
from ..types import (
    BetPageRows,
    BetScope,
    DayRange,
    ExposureRows,
    MatchAnalysisRows,
    ReaderDimension,
    Row,
    SessionKind,
    ShopDailyRows,
    SubjectKind,
    Window,
)
from . import analytics_sql as sql

Connection = AsyncConnection[DictRow]

_SUBJECT_COLUMNS: dict[str, str] = {
    "CUSTOMER": "user_id",
    "SHOP": "shop_id",
    "CASHIER": "cashier_id",
}

_SESSION_UNITS: dict[str, str] = {"HOUR": "hour", "DAY": "day"}


class PostgresAnalyticsReader(AnalyticsReader):
    def __init__(
        self, pool: Pool, report_timezone: str, logger: logging.Logger
    ) -> None:
        self._pool = pool
        self._timezone = report_timezone
        self._logger = logger

    @asynccontextmanager
    async def _snapshot(self) -> AsyncIterator[Connection]:
        try:
            async with self._pool.connection() as connection:
                await connection.set_read_only(True)
                await connection.set_isolation_level(
                    IsolationLevel.REPEATABLE_READ
                )
                yield connection
        except (psycopg.Error, PoolTimeout) as error:
            self._logger.error(
                "Analytics read failed",
                extra={"event": "database_read_failed", "error": str(error)},
            )
            raise DatabaseUnavailableError from error

    @staticmethod
    async def _all(connection: Connection, query: str, params: sql.Params) -> list[Row]:
        cursor = await connection.execute(query.encode("utf-8"), params)
        return await cursor.fetchall()

    @staticmethod
    async def _one(connection: Connection, query: str, params: sql.Params) -> Row:
        cursor = await connection.execute(query.encode("utf-8"), params)
        row = await cursor.fetchone()

        if row is None:
            raise psycopg.DataError("An aggregate statement answered no row.")

        return row

    async def overview(self, scope: BetScope) -> Row:
        params: sql.Params = {}
        query = sql.overview_sql(scope, params)

        async with self._snapshot() as connection:
            return await self._one(connection, query, params)

    async def bets(self, scope: BetScope, page: int, page_size: int) -> BetPageRows:
        count_params: sql.Params = {}
        count_query = sql.bets_count_sql(scope, count_params)
        page_params: sql.Params = {
            "limit": page_size,
            "offset": (page - 1) * page_size,
        }
        page_query = sql.bets_page_sql(scope, page_params)

        async with self._snapshot() as connection:
            total = await self._one(connection, count_query, count_params)
            bets = await self._all(connection, page_query, page_params)
            legs = (
                await self._all(
                    connection,
                    sql.BET_LEGS_SQL,
                    {"bet_ids": [str(bet["id"]) for bet in bets]},
                )
                if bets
                else []
            )

        return BetPageRows(total=int(total["total"]), bets=bets, legs=legs)

    async def match_analysis(self, match_id: str) -> MatchAnalysisRows | None:
        scope = BetScope(match_id=match_id)

        async with self._snapshot() as connection:
            matches = await self._all(
                connection, sql.MATCH_SQL, {"match_id": match_id}
            )

            if not matches:
                return None

            overview_params: sql.Params = {}
            overview = await self._one(
                connection, sql.overview_sql(scope, overview_params), overview_params
            )

            breakdowns: list[list[Row]] = []

            for dimension in ("market_id", "selection_id"):
                params: sql.Params = {"limit": 500}
                query = sql.breakdown_sql(dimension, scope, params)  # type: ignore[arg-type]
                breakdowns.append(await self._all(connection, query, params))

        return MatchAnalysisRows(
            match=matches[0],
            overview=overview,
            by_market=breakdowns[0],
            by_selection=breakdowns[1],
        )

    async def breakdown(
        self, dimension: ReaderDimension, scope: BetScope, limit: int
    ) -> list[Row]:
        params: sql.Params = {"limit": limit, "tz": self._timezone}
        query = sql.breakdown_sql(dimension, scope, params)

        if "%(tz)s" not in query:
            del params["tz"]

        async with self._snapshot() as connection:
            return await self._all(connection, query, params)

    async def exposure(self, scope: BetScope, limit: int) -> ExposureRows:
        async with self._snapshot() as connection:
            totals_params: sql.Params = {}
            totals = await self._one(
                connection,
                sql.exposure_totals_sql(scope, totals_params),
                totals_params,
            )

            match_params: sql.Params = {"limit": limit}
            matches = await self._all(
                connection,
                sql.exposure_level_sql(
                    "match", scope, match_params, within_matches=False
                ),
                match_params,
            )

            deeper: list[list[Row]] = []

            for level in ("market", "selection"):
                if not matches:
                    deeper.append([])
                    continue

                params: sql.Params = {
                    "match_ids": [str(row["match_id"]) for row in matches]
                }
                deeper.append(
                    await self._all(
                        connection,
                        sql.exposure_level_sql(
                            level, scope, params, within_matches=True
                        ),
                        params,
                    )
                )

        return ExposureRows(
            totals=totals, matches=matches, markets=deeper[0], selections=deeper[1]
        )

    async def operator(self, scope: BetScope) -> Row:
        params: sql.Params = {}
        query = sql.operator_sql(scope, params)

        async with self._snapshot() as connection:
            return await self._one(connection, query, params)

    async def platform_overview(self) -> Row:
        async with self._snapshot() as connection:
            return await self._one(
                connection,
                sql.PLATFORM_OVERVIEW_SQL,
                {"tz": self._timezone, "minutes": ACTIVE_USER_WINDOW_MINUTES},
            )

    async def daily_reports(self, days: DayRange) -> list[Row]:
        async with self._snapshot() as connection:
            return await self._all(
                connection,
                sql.DAILY_REPORTS_SQL,
                {"first": days.first, "last": days.last, "tz": self._timezone},
            )

    async def sessions(
        self, kind: SessionKind, scope: BetScope, limit: int
    ) -> list[Row]:
        params: sql.Params = {"limit": limit}

        if kind in _SESSION_UNITS:
            params["tz"] = self._timezone
            query = sql.bucket_sessions_sql(_SESSION_UNITS[kind], scope, params)
        elif kind == "CUSTOM":
            del params["limit"]
            query = sql.overview_sql(scope, params)
        else:
            query = sql.round_sessions_sql(scope, params)

        async with self._snapshot() as connection:
            return await self._all(connection, query, params)

    async def account(
        self, kind: SubjectKind, subject_id: str, window: Window
    ) -> Row | None:
        scope = replace(
            BetScope(window=window), **{_SUBJECT_COLUMNS[kind]: subject_id}
        )
        params: sql.Params = {"subject_id": subject_id}
        query = sql.account_sql(kind, scope, params)

        async with self._snapshot() as connection:
            subjects = await self._all(
                connection, sql.subject_label_sql(kind), {"subject_id": subject_id}
            )

            if not subjects:
                return None

            figures = await self._one(connection, query, params)

        return {**figures, "label": subjects[0]["label"]}

    async def shop_daily(self, shop_id: str, days: DayRange) -> ShopDailyRows:
        params: sql.Params = {
            "shop_id": shop_id,
            "first": days.first,
            "last": days.last,
            "tz": self._timezone,
        }

        async with self._snapshot() as connection:
            return ShopDailyRows(
                days=await self._all(connection, sql.SHOP_DAYS_SQL, params),
                by_cashier=await self._all(
                    connection, sql.SHOP_CASHIERS_SQL, params
                ),
                by_league=await self._all(connection, sql.SHOP_LEAGUES_SQL, params),
            )


def create_analytics_reader(
    pool: Pool, report_timezone: str, logger: logging.Logger
) -> AnalyticsReader:
    return PostgresAnalyticsReader(pool, report_timezone, logger)
