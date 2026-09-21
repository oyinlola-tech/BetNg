from __future__ import annotations

import logging
from uuid import UUID

from betng_service_kit import CommandHandler

from .....constants import RiskCommand
from .....dtos import FreezeExposureResult
from .....errors import MatchNotFoundError
from .....interfaces import RiskRepository
from ...exposure_reader import ExposureReader
from .freeze_exposure_command import FreezeExposureCommand


class FreezeExposureHandler(
    CommandHandler[FreezeExposureCommand, FreezeExposureResult]
):
    message_type = RiskCommand.FREEZE_EXPOSURE

    def __init__(
        self,
        repository: RiskRepository,
        reader: ExposureReader,
        logger: logging.Logger,
    ) -> None:
        self._repository = repository
        self._reader = reader
        self._logger = logger

    async def execute(self, message: FreezeExposureCommand) -> FreezeExposureResult:
        matches = await self._repository.load_matches([message.match_id])
        if not matches:
            raise MatchNotFoundError

        match = matches[0]
        if match.frozen_at is not None:
            return FreezeExposureResult(
                match_id=UUID(match.match_id), frozen_at=match.frozen_at
            )

        limits = (await self._repository.load_limits()).limits
        exposure = (await self._reader.live([match], limits))[0]
        frozen_at = await self._repository.insert_freeze(
            match.match_id,
            exposure.model_dump(mode="json", by_alias=True, exclude_none=True),
        )

        self._logger.info(
            "Exposure frozen",
            extra={"event": "exposure_frozen", "matchId": match.match_id},
        )

        return FreezeExposureResult(match_id=UUID(match.match_id), frozen_at=frozen_at)
