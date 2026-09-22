"""Sealed daily figures, kept in process: the login cannot write a table.

A day is sealed once it ended more than ``grace`` ago and none of its bets is
PENDING. Bets leave PENDING exactly once and are placed at the betting
service's clock, so a sealed day's figures can no longer change.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import psycopg
from betng_service_kit import Pool
from psycopg import IsolationLevel
from psycopg_pool import PoolTimeout

from ..types import DayRange, Row
from ..utils import now as utc_now
from . import analytics_sql as sql

POOL_TIMEOUT_SECONDS = 5.0


class DailySummary:
    def __init__(
        self,
        pool: Pool,
        report_timezone: str,
        logger: logging.Logger,
        *,
        grace: timedelta = timedelta(hours=1),
        clock: Callable[[], datetime] = utc_now,
    ) -> None:
        self._pool = pool
        self._timezone = report_timezone
        self._zone = ZoneInfo(report_timezone)
        self._logger = logger
        self._grace = grace
        self._clock = clock
        self._sealed: dict[date, Row] = {}

    def __len__(self) -> int:
        return len(self._sealed)

    def sealed(self, days: DayRange) -> dict[date, Row]:
        found: dict[date, Row] = {}
        day = days.first

        while day <= days.last:
            row = self._sealed.get(day)
            if row is not None:
                found[day] = dict(row)
            day += timedelta(days=1)

        return found

    def _day_end(self, day: date) -> datetime:
        return datetime.combine(day + timedelta(days=1), time.min, self._zone)

    def prune(self, before: date) -> None:
        for day in [day for day in self._sealed if day < before]:
            del self._sealed[day]

    async def refresh(self, days: DayRange) -> int:
        """Seal every closed, fully settled day of ``days``; answer how many."""
        cutoff = self._clock() - self._grace
        last = days.last

        while last >= days.first and self._day_end(last) > cutoff:
            last -= timedelta(days=1)

        if last < days.first:
            return 0

        params = {
            "first": days.first,
            "last": last,
            "tz": self._timezone,
            "sealed": sorted(day for day in self._sealed if days.first <= day <= last),
        }

        try:
            async with self._pool.connection(POOL_TIMEOUT_SECONDS) as connection:
                await connection.set_read_only(True)
                await connection.set_isolation_level(IsolationLevel.REPEATABLE_READ)
                cursor = await connection.execute(
                    sql.DAILY_SUMMARY_SQL.encode("utf-8"), params
                )
                rows = await cursor.fetchall()
        except (psycopg.Error, PoolTimeout) as error:
            self._logger.warning(
                "Daily summary refresh failed",
                extra={"event": "daily_summary_failed", "error": type(error).__name__},
            )
            return 0

        added = 0
        for row in rows:
            if row["pending_bets"] == 0:
                self._sealed[row["day"]] = {
                    key: value for key, value in row.items() if key != "pending_bets"
                }
                added += 1

        return added
