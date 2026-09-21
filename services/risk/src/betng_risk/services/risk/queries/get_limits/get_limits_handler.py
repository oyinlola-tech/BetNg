"""Reads the limits in force."""

from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import RiskQuery
from .....dtos import RiskLimits
from .....interfaces import RiskRepository
from ...limits_view import to_risk_limits
from .get_limits_query import GetLimitsQuery


class GetLimitsHandler(QueryHandler[GetLimitsQuery, RiskLimits]):
    """Answers with the active ``risk.risk_limits`` row."""

    message_type = RiskQuery.GET_LIMITS

    def __init__(self, repository: RiskRepository) -> None:
        """Bind the handler to the repository."""
        self._repository = repository

    async def execute(self, message: GetLimitsQuery) -> RiskLimits:
        """Return the active version."""
        return to_risk_limits(await self._repository.load_limits())
