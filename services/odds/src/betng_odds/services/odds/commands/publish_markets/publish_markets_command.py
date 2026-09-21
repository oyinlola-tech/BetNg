from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Command

from .....constants import OddsCommand
from .....dtos import PublishMarketsRequest, PublishMarketsResult


@dataclass(frozen=True)
class PublishMarketsCommand(Command[PublishMarketsResult]):
    request: PublishMarketsRequest
    request_id: str | None

    type: str = OddsCommand.PUBLISH_MARKETS
