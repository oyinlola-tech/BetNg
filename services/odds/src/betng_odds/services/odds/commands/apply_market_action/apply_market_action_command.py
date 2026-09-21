"""An operator's action on one market."""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Actor, Command

from .....constants import OddsCommand
from .....dtos import AdminMarketOdds, MarketAdminActionRequest


@dataclass(frozen=True)
class ApplyMarketActionCommand(Command[AdminMarketOdds]):
    """Suspend or resume a market, as the gateway-asserted admin."""

    market_id: str
    request: MarketAdminActionRequest
    actor: Actor
    request_id: str

    type: str = OddsCommand.APPLY_MARKET_ACTION
