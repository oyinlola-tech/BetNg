"""Read the active pricing configuration."""

from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import Query

from .....constants import OddsQuery
from .....dtos import PricingConfigurationView


@dataclass(frozen=True)
class GetPricingConfigurationQuery(Query[PricingConfigurationView]):
    """The configuration new markets are priced under."""

    type: str = OddsQuery.GET_PRICING_CONFIGURATION
