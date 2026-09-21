from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import RiskQuery
from .....dtos import RiskLimits
from .....interfaces import RiskRepository
from ...limits_view import to_risk_limits
from .get_limits_query import GetLimitsQuery


class GetLimitsHandler(QueryHandler[GetLimitsQuery, RiskLimits]):
    message_type = RiskQuery.GET_LIMITS

    def __init__(self, repository: RiskRepository) -> None:
        self._repository = repository

    async def execute(self, message: GetLimitsQuery) -> RiskLimits:
        return to_risk_limits(await self._repository.load_limits())
