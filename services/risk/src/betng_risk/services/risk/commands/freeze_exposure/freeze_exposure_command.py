from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Command

from .....constants import RiskCommand
from .....dtos import FreezeExposureResult


@dataclass(frozen=True)
class FreezeExposureCommand(Command[FreezeExposureResult]):
    """Stores a match's exposure as it stands when betting closes."""

    match_id: str

    type: str = RiskCommand.FREEZE_EXPOSURE
