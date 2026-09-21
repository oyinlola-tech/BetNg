from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Actor, Command

from .....constants import OddsCommand
from .....dtos import PricingConfigurationView, UpdatePricingConfigurationRequest


@dataclass(frozen=True)
class UpdatePricingConfigurationCommand(Command[PricingConfigurationView]):
    request: UpdatePricingConfigurationRequest
    actor: Actor
    request_id: str

    type: str = OddsCommand.UPDATE_PRICING_CONFIGURATION
