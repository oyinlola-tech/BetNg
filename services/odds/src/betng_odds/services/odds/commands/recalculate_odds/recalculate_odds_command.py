from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from betng_service_kit import Command

from .....constants import OddsCommand
from .....dtos import RecalculateOddsResult

MatchEventType = Literal["GOAL", "RED_CARD", "HALF_TIME", "SECOND_HALF"]


@dataclass(frozen=True)
class RecalculateOddsCommand(Command[RecalculateOddsResult]):
    match_id: str
    event_type: MatchEventType
    minute: int
    score_home: int
    score_away: int
    request_id: str | None = None

    type: str = OddsCommand.RECALCULATE_ODDS
