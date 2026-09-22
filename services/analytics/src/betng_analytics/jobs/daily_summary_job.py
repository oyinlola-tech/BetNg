from __future__ import annotations

import asyncio
import logging
from datetime import timedelta

from ..constants import MAX_REPORT_DAYS
from ..repositories import DailySummary
from ..types import DayRange
from ..utils import today_in


async def refresh_once(summary: DailySummary, report_timezone: str) -> int:
    today = today_in(report_timezone)
    first = today - timedelta(days=MAX_REPORT_DAYS)
    summary.prune(first)

    return await summary.refresh(DayRange(first=first, last=today))


async def run_daily_summary_job(
    summary: DailySummary,
    report_timezone: str,
    interval_seconds: int,
    logger: logging.Logger,
) -> None:
    while True:
        sealed = await refresh_once(summary, report_timezone)

        if sealed:
            logger.info(
                "Daily summary refreshed",
                extra={
                    "event": "daily_summary_refreshed",
                    "sealed": sealed,
                    "days": len(summary),
                },
            )

        await asyncio.sleep(interval_seconds)
