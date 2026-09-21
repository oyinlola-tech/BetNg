from __future__ import annotations

import logging
from dataclasses import dataclass

from betng_service_kit import CommandHandler

from .....constants import MATCH_STATUS_SOURCES, OddsCommand
from .....dtos import SetMatchMarketsStatusResult
from .....interfaces import OddsRepository
from .set_match_markets_status_command import SetMatchMarketsStatusCommand


@dataclass(frozen=True)
class SetMatchMarketsStatusHandler(
    CommandHandler[SetMatchMarketsStatusCommand, SetMatchMarketsStatusResult]
):
    repository: OddsRepository
    logger: logging.Logger

    message_type = OddsCommand.SET_MATCH_MARKETS_STATUS

    async def execute(
        self, message: SetMatchMarketsStatusCommand
    ) -> SetMatchMarketsStatusResult:
        match_id = str(message.request.match_id)
        status = message.request.status
        updated = await self.repository.set_match_markets_status(
            match_id, status, MATCH_STATUS_SOURCES[status]
        )

        self.logger.info(
            "Match markets status set",
            extra={
                "matchId": match_id,
                "requestId": message.request_id,
                "event": "markets_status_changed",
                "status": status,
                "updated": updated,
            },
        )

        return SetMatchMarketsStatusResult(updated=updated)
