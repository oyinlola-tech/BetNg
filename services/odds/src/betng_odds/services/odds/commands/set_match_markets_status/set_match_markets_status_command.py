from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Command

from .....constants import OddsCommand
from .....dtos import SetMatchMarketsStatusRequest, SetMatchMarketsStatusResult


@dataclass(frozen=True)
class SetMatchMarketsStatusCommand(Command[SetMatchMarketsStatusResult]):
    request: SetMatchMarketsStatusRequest
    request_id: str | None

    type: str = OddsCommand.SET_MATCH_MARKETS_STATUS
