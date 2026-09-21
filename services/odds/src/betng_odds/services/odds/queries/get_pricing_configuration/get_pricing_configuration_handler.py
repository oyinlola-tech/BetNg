from __future__ import annotations

from dataclasses import dataclass

from betng_service_kit import QueryHandler

from .....constants import OddsQuery
from .....dtos import PricingConfigurationView
from .....interfaces import OddsRepository
from .....utils import to_configuration_view
from .get_pricing_configuration_query import GetPricingConfigurationQuery


@dataclass(frozen=True)
class GetPricingConfigurationHandler(
    QueryHandler[GetPricingConfigurationQuery, PricingConfigurationView]
):
    repository: OddsRepository

    message_type = OddsQuery.GET_PRICING_CONFIGURATION

    async def execute(
        self, message: GetPricingConfigurationQuery
    ) -> PricingConfigurationView:
        return to_configuration_view(await self.repository.get_active_configuration())
