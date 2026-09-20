"""The command that prices a match's markets."""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Command

from .....constants import OddsCommand
from .....dtos import CalculateOddsRequest


@dataclass(frozen=True)
class GenerateOddsCommand(Command):
    """Asks for a match's markets to be priced from its probabilities."""

    request: CalculateOddsRequest

    type: str = OddsCommand.GENERATE_ODDS
