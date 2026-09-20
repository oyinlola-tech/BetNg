from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Command

from .....constants import OddsCommand
from .....dtos import CalculateOddsRequest


@dataclass(frozen=True)
class GenerateOddsCommand(Command):
    request: CalculateOddsRequest

    type: str = OddsCommand.GENERATE_ODDS
