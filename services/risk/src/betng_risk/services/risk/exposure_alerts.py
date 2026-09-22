from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import Sequence
from typing import Literal

from ...interfaces import RiskRepository, SignalPublisher
from ...types import AlertCrossing
from ...utils import match_worst_case, to_exposure_book

ALERT_THRESHOLDS = (80, 100)
RISK_ALERT_CHANNEL = "risk"
RISK_ALERT_SIGNAL = "RISK_ALERT"


def crossed_thresholds(
    scope: Literal["MARKET", "MATCH"],
    scope_id: str,
    match_id: str,
    exposure: int,
    limit: int,
    limits_version: int,
) -> list[AlertCrossing]:
    return [
        AlertCrossing(
            scope=scope,
            scope_id=scope_id,
            match_id=match_id,
            threshold=threshold,
            exposure=exposure,
            limit=limit,
            limits_version=limits_version,
        )
        for threshold in ALERT_THRESHOLDS
        if limit > 0 and exposure * 100 >= threshold * limit
    ]


class ExposureAlertMonitor:
    """Alerts once when a market or match crosses 80% or 100% of its limit."""

    def __init__(
        self,
        repository: RiskRepository,
        publisher: SignalPublisher,
        logger: logging.Logger,
    ) -> None:
        self._repository = repository
        self._publisher = publisher
        self._logger = logger

    async def check(
        self, match_ids: Sequence[str] | None = None
    ) -> list[AlertCrossing]:
        limits = (await self._repository.load_limits()).limits
        book = to_exposure_book(await self._repository.load_book(match_ids))

        crossings: list[AlertCrossing] = []
        for market in book.markets.values():
            crossings.extend(
                crossed_thresholds(
                    "MARKET",
                    market.market_id,
                    market.match_id,
                    market.worst_case(),
                    limits.max_liability_per_market,
                    limits.version,
                )
            )
        for match_id in sorted({market.match_id for market in book.markets.values()}):
            crossings.extend(
                crossed_thresholds(
                    "MATCH",
                    match_id,
                    match_id,
                    match_worst_case(match_id, book),
                    limits.max_liability_per_match,
                    limits.version,
                )
            )

        fresh = await self._repository.sync_alerts(crossings, match_ids)
        request_id = f"risk-alert-{uuid.uuid4()}"

        for crossing in fresh:
            self._logger.warning(
                "Risk exposure alert",
                extra={
                    "requestId": request_id,
                    "event": "risk_alert",
                    "alert": "RISK_ALERT",
                    "scope": crossing.scope,
                    "scopeId": crossing.scope_id,
                    "matchId": crossing.match_id,
                    "threshold": crossing.threshold,
                    "exposure": crossing.exposure,
                    "limit": crossing.limit,
                    "utilisationPercent": crossing.exposure * 100 // crossing.limit,
                    "limitsVersion": crossing.limits_version,
                },
            )
            await self._publisher.publish(
                RISK_ALERT_CHANNEL, RISK_ALERT_SIGNAL, request_id
            )

        return fresh


async def run_alert_job(
    monitor: ExposureAlertMonitor, interval_seconds: float, logger: logging.Logger
) -> None:
    while True:
        try:
            await monitor.check()
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logger.error(
                "Exposure alert sweep failed",
                extra={
                    "event": "risk_alert_sweep_failed",
                    "error": type(error).__name__,
                },
            )
        await asyncio.sleep(interval_seconds)
