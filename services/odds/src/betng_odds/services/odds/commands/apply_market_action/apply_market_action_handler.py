"""Suspend and resume.

An operator can stop and restart betting on a market. There is no action that
sets a price, a probability or an outcome: the only thing that changes is the
status, and with it the version and the snapshot history.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime

from betng_service_kit import CommandHandler

from .....constants import (
    BETTABLE_LIFECYCLES,
    AuditAction,
    MarketStatusValue,
    OddsCommand,
)
from .....dtos import AdminMarketOdds
from .....errors import (
    MarketClosedError,
    MarketNotFoundError,
    MarketStateConflictError,
)
from .....interfaces import (
    AuditRecorder,
    EventPublisher,
    ExposureReader,
    MatchDirectory,
    OddsRepository,
)
from .....types import AuditEntry, MarketRecord, MatchInfo
from .....utils import to_admin_market
from .apply_market_action_command import ApplyMarketActionCommand

_SUSPEND = "SUSPEND"
_FINAL_STATUSES = frozenset(
    {MarketStatusValue.CLOSED, MarketStatusValue.SETTLED, MarketStatusValue.VOID}
)
_AUDIT_SEVERITY = "WARNING"


def _is_bettable(match: MatchInfo | None) -> bool:
    return (
        match is not None
        and match.lifecycle in BETTABLE_LIFECYCLES
        and match.betting_closes_at > datetime.now(UTC)
    )


@dataclass(frozen=True)
class ApplyMarketActionHandler(
    CommandHandler[ApplyMarketActionCommand, AdminMarketOdds]
):
    """Apply one operator action, audited, then announce it."""

    repository: OddsRepository
    match_directory: MatchDirectory
    exposure_reader: ExposureReader
    audit_recorder: AuditRecorder
    event_publisher: EventPublisher
    logger: logging.Logger

    message_type = OddsCommand.APPLY_MARKET_ACTION

    async def execute(self, message: ApplyMarketActionCommand) -> AdminMarketOdds:
        """Change the market's status, or refuse without changing anything."""
        market = await self.repository.get_market(message.market_id)

        if market is None:
            raise MarketNotFoundError(message.market_id)

        match = (await self.match_directory.find([market.match_id])).get(
            market.match_id
        )

        if not _is_bettable(match):
            raise MarketClosedError(market.id)

        suspend = message.request.action == _SUSPEND

        def decide(current: MarketRecord) -> str:
            if current.status in _FINAL_STATUSES:
                raise MarketClosedError(current.id)
            if suspend and current.status != MarketStatusValue.OPEN:
                raise MarketStateConflictError("That market is not open.")
            if not suspend and current.status != MarketStatusValue.SUSPENDED:
                raise MarketStateConflictError("That market is not suspended.")

            return MarketStatusValue.SUSPENDED if suspend else MarketStatusValue.OPEN

        async def audit(before: MarketRecord, after: MarketRecord) -> None:
            await self.audit_recorder.record(
                AuditEntry(
                    actor_id=message.actor.id,
                    actor_role=message.actor.role,
                    action=(
                        AuditAction.MARKET_SUSPENDED
                        if suspend
                        else AuditAction.MARKET_RESUMED
                    ),
                    entity_type="market",
                    entity_id=after.id,
                    before={
                        "status": before.status,
                        "oddsVersion": before.odds_version,
                    },
                    after={"status": after.status, "oddsVersion": after.odds_version},
                    reason=message.request.reason,
                    severity=_AUDIT_SEVERITY,
                    request_id=message.request_id,
                )
            )

        updated = await self.repository.change_market_status(
            message.market_id, decide, audit
        )

        if updated is None:
            raise MarketNotFoundError(message.market_id)

        self.logger.info(
            "Market action applied",
            extra={
                "matchId": updated.match_id,
                "requestId": message.request_id,
                "event": "market_suspended" if suspend else "market_resumed",
                "marketId": updated.id,
                "oddsVersion": updated.odds_version,
            },
        )
        await self._announce(updated, suspend, message.request_id)

        return to_admin_market(
            updated,
            match,
            await self.repository.opening_odds([updated.id]),
            await self.exposure_reader.by_selection([updated.id]),
        )

    async def _announce(
        self, market: MarketRecord, suspend: bool, request_id: str
    ) -> None:
        """Tell live clients to re-read. The change stands if this fails."""
        description = (
            f"{market.type} market {'suspended' if suspend else 'resumed'}"
        )

        try:
            await self.event_publisher.publish_odds_updated(
                market.match_id, description, request_id
            )
        except Exception:
            self.logger.warning(
                "ODDS_UPDATED could not be published",
                extra={
                    "matchId": market.match_id,
                    "requestId": request_id,
                    "marketId": market.id,
                },
                exc_info=True,
            )
